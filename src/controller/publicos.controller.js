const { where } = require("sequelize");
const {
  sendEmailCrearContrasena,
  sendEmailConfirmacionPostulacion,
} = require("../configs/mail.config");
const {
  Edicion,
  Usuario,
  Rol,
  RequisitosEdicion,
  Requisitos,
  RequisitosConfig,
  EdicionCategoria,
  Categoria,
  RequisitosEdicionCategoria,
  RequisitosCategoriaConfig,
  UsuarioRol,
  UsuarioToken,
  ParticipacionJurado,
  Participacion,
  Convocatoria,
  ParticipacionRequisito,
} = require("../models");
const sequelize = require("../configs/db");
const jwt = require("jsonwebtoken");
const path = require("path");
const NotificacionService = require("../middlewares/notificaciones.js");

const obtenerEdicionEnProcesoPublico = async (req, res) => {
  try {
    const { token } = req.params;

    const edicion = await Edicion.findOne({
      where: { estado_edicion: "en_proceso" },
    });

    if (!edicion) {
      return res.status(404).json({
        message: "No hay edición en proceso.",
      });
    }

    return res
      .status(200)
      .json({ message: "Edición obtenida con exito.", edicion });
  } catch (error) {
    console.error(error);
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "El enlace de la convocatoria no es válido o ha expirado.",
      });
    }
    return res.status(500).json({
      message: "Ocurrió un error al obtener la información de la edición.",
    });
  }
};

const obtenerUsuarioPorCedulaPublico = async (req, res) => {
  try {
    const { numero_documento } = req.params;
    const { id_edicion } = req.accesoConvocatoria;

    const usuario = await Usuario.findOne({
      where: { numero_documento },
      include: [
        {
          model: Rol,
          as: "roles",
          through: {
            where: { id_rol: 4, estado_rol: "activo" },
          },
        },
      ],
    });

    if (!usuario) {
      return res.json({ message: "Usuario no encontrado" });
    }

    const es_participante = await Usuario.findOne({
      where: { numero_documento },
      include: [
        {
          model: Rol,
          as: "roles",
          through: {
            where: { id_rol: 4 },
          },
        },
      ],
    });

    if (es_participante.roles.length === 0) {
      return res.status(404).json({
        message:
          "Usuario no es participante. No puede postularse en la edición",
        usuario: es_participante,
      });
    }

    if (usuario.roles.length === 0) {
      return res.status(404).json({
        message:
          "El participante esta inactivo. No puede postularse en la edición",
        usuario: usuario,
      });
    }

    const es_administrador = await Usuario.findOne({
      where: { numero_documento },
      include: [
        {
          model: Rol,
          as: "roles",
          through: {
            where: { id_rol: 2 },
          },
        },
      ],
    });

    if (es_administrador.roles.length > 0) {
      return res.status(404).json({
        message:
          "No es posible registrar la participación porque el usuario ingresado tiene asignado el rol de administrador en PAMCE.",
        usuario: es_administrador,
      });
    }

    const es_jurado_en_edicion = await ParticipacionJurado.findOne({
      where: {
        id_jurado: usuario.id_usuario,
      },
      include: [
        {
          model: Participacion,
          as: "participacion",
          where: {
            id_edicion,
          },
          attributes: ["id_participacion", "id_edicion"],
        },
      ],
    });

    if (es_jurado_en_edicion) {
      return res.status(409).json({
        message:
          "No es posible registrar la participación porque el usuario se encuentra asignado como jurado en esta edición de PAMCE.",
        usuario: usuario,
      });
    }

    return res.json({ message: "Usuario encontrado", usuario: usuario });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error interno" });
  }
};

const listarRequisitosEdicionPublico = async (req, res) => {
  try {
    const { id_edicion } = req.params;

    const edicion = await Edicion.findByPk(id_edicion, {
      attributes: ["id_edicion"],
      include: [
        {
          model: RequisitosEdicion,
          as: "RequisitosEdicion",
          attributes: ["id_requisito_edicion", "obligatorio", "tipo_requisito"],
          include: [
            {
              model: Requisitos,
              attributes: ["id_requisito", "descripcion"],
            },
            {
              model: RequisitosConfig,
              as: "RequisitosConfig",
              attributes: [
                "extensiones_permitidas",
                "tamano_max_mb",
                "max_caracteres",
              ],
            },
          ],
        },
      ],
    });

    if (!edicion) {
      return res.status(404).json({ message: "Edición no encontrada" });
    }

    if (edicion.RequisitosEdicion.length === 0) {
      return res
        .status(404)
        .json({ message: "Esta edición aún no tiene requisitos definidos" });
    }

    return res.json({
      mensaje: "Requisitos de la Edición obtenidos correctamente",
      requisitos: edicion.RequisitosEdicion,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarCategoriasPorEdicionPublico = async (req, res) => {
  try {
    const { id_edicion } = req.params;

    const edicion = await Edicion.findByPk(id_edicion);

    if (!edicion) {
      return res.status(404).json({ message: "Edición no encontrada" });
    }

    const categorias = await Categoria.findAll({
      include: [
        {
          model: EdicionCategoria,
          as: "edicionesCategoria",
          required: true,
          where: {
            estado: "activo",
          },
          include: [
            {
              model: Edicion,
              as: "edicion",
              required: true,
              where: {
                id_edicion,
              },
            },
          ],
        },
      ],
    });

    if (categorias.length === 0) {
      return res
        .status(404)
        .json({ message: "Esta edición aún no tiene categorías definidas" });
    }

    return res.json({
      message: "Categorías obtenidas correctamente",
      categorias: categorias,
    });
  } catch (error) {
    console.error("Error al listar categorías por edición:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarRequisitosCategoriaEdicionPublico = async (req, res) => {
  try {
    const { id_edicion_categoria } = req.params;
    const { id_edicion } = req.accesoConvocatoria;

    const edicion_categoria =
      await EdicionCategoria.findByPk(id_edicion_categoria);

    if (!edicion_categoria) {
      return res.status(404).json({ message: "Categoria no encontrada" });
    }

    const requisitos = await RequisitosEdicionCategoria.findAll({
      where: {
        id_edicion_categoria: id_edicion_categoria,
      },
      include: [
        {
          model: Requisitos,
          as: "Requisito",
        },
        {
          model: RequisitosCategoriaConfig,
          as: "RequisitosCategoriaConfig",
        },
      ],
      distinct: true,
      subQuery: false,
    });

    if (requisitos.length === 0) {
      return res.status(200).json({
        requisitos: [],
        message: "Esta categoría aún no tiene requisitos definidos",
      });
    }

    return res.json({
      mensaje: "Requisitos de la categoria obtenidos correctamente",
      requisitos: requisitos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const agregarParticipantePublico = async (req, res) => {
  try {
    const {
      numero_documento,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo_electronico,
      telefono,
      direccion,
      codigo_institucional,
      genero,
      nivel_estudio_superior,
      fecha_nacimiento,
    } = req.body;

    const { id_edicion } = req.accesoConvocatoria;

    let usuario = await Usuario.findOne({
      where: { numero_documento },
      include: [
        {
          model: Rol,
          as: "roles",
        },
      ],
    });

    if (usuario) {
      if (
        usuario.roles?.some(
          (rol) => rol.id_rol === 4 && rol.UsuarioRol.estado_rol === "activo",
        )
      ) {
        return res.status(201).json({
          message: "El usuario ya está registrado como participante activo",
          usuario,
        });
      }

      if (
        usuario.roles?.some(
          (rol) => rol.id_rol === 4 && rol.UsuarioRol.estado_rol === "inactivo",
        )
      ) {
        return res.status(400).json({
          message:
            "El usuario ya está registrado como participante, pero su estado en el sistema es inactivo. Por favor, contacta con el administrador, no se permite la postulación a la edición",
        });
      }

      await usuario.addRole(4, {
        through: { estado_rol: "activo" },
      });

      return res.status(200).json({
        message:
          "Rol de participante asignado correctamente al usuario existente",
      });
    }

    const correoExistente = await Usuario.findOne({
      where: { correo_electronico },
    });

    if (correoExistente) {
      return res.status(400).json({
        message: "El correo electrónico ya está registrado",
      });
    }

    if (codigo_institucional) {
      const codigoExistente = await Usuario.findOne({
        where: { codigo_institucional },
      });

      if (codigoExistente) {
        return res.status(400).json({
          message: "El código institucional ya está registrado",
        });
      }
    }

    const telefonoExistente = await Usuario.findOne({
      where: { telefono },
    });

    if (telefonoExistente) {
      return res.status(400).json({
        message: "El número de teléfono ya está registrado",
      });
    }

    const nuevoUsuario = await Usuario.create({
      tipo_documento: "CC",
      numero_documento,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo_electronico,
      telefono,
      direccion,
      genero,
      fecha_nacimiento,
      nivel_estudio_superior,
      codigo_institucional,
      estado: "inactivo",
      contrasena: "contra_prueba",
      fecha_registro: new Date(),
      creo_contrasena: false,
    });

    await nuevoUsuario.addRole(4, {
      through: { estado_rol: "inactivo" },
    });

    const participante = await Usuario.findOne({
      where: {
        id_usuario: nuevoUsuario.id_usuario,
      },
      attributes: [
        "id_usuario",
        "tipo_documento",
        "numero_documento",
        "primer_nombre",
        "segundo_nombre",
        "primer_apellido",
        "segundo_apellido",
        "correo_electronico",
        "fecha_nacimiento",
        "telefono",
        "genero",
        "direccion",
        "fecha_registro",
        "nivel_estudio_superior",
        "fecha_actualizacion",
        "codigo_institucional",
      ],
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 4 },
          attributes: ["id_rol", "nombre_rol"],
          through: {
            model: UsuarioRol,
            attributes: ["estado_rol", "fecha_registro", "fecha_actualizacion"],
          },
        },
      ],
    });

    const tokenCreacion = jwt.sign(
      {
        id_usuario: participante.id_usuario,
        id_rol: 4,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    await UsuarioToken.create({
      id_usuario: nuevoUsuario.id_usuario,
      token: tokenCreacion,
      usado: false,
      fecha_creacion: new Date(),
      fecha_expiracion: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const enlaceCreacion = `${process.env.FRONTEND_URL}/crear-clave/${tokenCreacion}`;

    await sendEmailCrearContrasena(
      nuevoUsuario.correo_electronico,
      nuevoUsuario.primer_nombre,
      enlaceCreacion,
    );

    return res.status(201).json({
      message:
        "Usuario registrado correctamente y rol participante asignado. Se envió un correo para que cree su contraseña.",
      usuario: participante,
    });
  } catch (error) {
    console.error("Error al agregar participante:", error);

    return res.status(500).json({
      message: "Error en el servidor",
    });
  }
};

const obtenerEdicionEnProcesoFanPage = async (req, res) => {
  try {
    const edicion = await Edicion.findOne({
      where: { estado_edicion: "en_proceso" },
      include: [
        {
          model: EdicionCategoria,
          as: "categoriasEdicion",
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
          ],
        },
      ],
      distinct: true,
    });

    if (!edicion) {
      return res.status(200).json({
        hay_edicion: false,
        message: "Actualmente no hay una edición en proceso.",
        edicion: null,
      });
    }

    return res.status(200).json({
      hay_edicion: true,
      message: "Edición obtenida correctamente.",
      edicion,
    });
  } catch (error) {
    console.error("Error al consultar la edición pública:", error);

    return res.status(500).json({
      message: "Ocurrió un error al consultar la edición.",
    });
  }
};

const obtenerEdicionesFanPage = async (req, res) => {
  try {
    const ediciones = await Edicion.findAll({
      distinct: true,
    });

    return res.json({
      message: "Ediciones obtenidas correctamente",
      ediciones,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const registrarParticipacionPublico = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_usuario, id_edicion, id_edicion_categoria } = req.body;

    if (!id_usuario || !id_edicion || !id_edicion_categoria) {
      return res.status(400).json({
        message: "Datos obligatorios incompletos",
      });
    }

    const existeParticipacion = await Participacion.findOne({
      where: {
        id_usuario,
        id_edicion,
        id_edicion_categoria,
      },
      transaction,
    });

    if (existeParticipacion) {
      return res.status(400).json({
        message:
          "El usuario ya está registrado como participante para esa categoría en la edición. Cambie la categoría a la que desea participar",
      });
    }

    const participacion = await Participacion.create(
      {
        id_usuario,
        id_edicion,
        id_edicion_categoria,
      },
      { transaction },
    );

    const id_participacion = participacion.id_participacion;
    const textosEdicion = req.body.requisitos_edicion_texto || [];

    for (const item of textosEdicion) {
      const data = JSON.parse(item);

      await ParticipacionRequisito.create(
        {
          id_participacion,
          id_requisito_edicion: data.id_requisito_edicion,
          tipo_respuesta: "texto",
          valor_texto: data.valor_texto,
        },
        { transaction },
      );
    }

    const textosCategoria = req.body.requisitos_categoria_texto || [];

    for (const item of textosCategoria) {
      const data = JSON.parse(item);

      await ParticipacionRequisito.create(
        {
          id_participacion,
          id_requisito_edicion_categoria: data.id_requisito_edicion_categoria,
          tipo_respuesta: "texto",
          valor_texto: data.valor_texto,
        },
        { transaction },
      );
    }

    for (const file of req.files || []) {
      const match = file.fieldname.match(/\[(\d+)\]/);
      if (!match) continue;

      const isEdicion = file.fieldname.startsWith(
        "requisitos_edicion_documentos",
      );

      await ParticipacionRequisito.create(
        {
          id_participacion,
          id_requisito_edicion: isEdicion ? match[1] : null,
          id_requisito_edicion_categoria: isEdicion ? null : match[1],
          tipo_respuesta: "documento",
          ruta_archivo: path
            .relative(path.join(__dirname, ".."), file.path)
            .replace(/\\/g, "/"),
          nombre_archivo: file.originalname,
          extension_archivo: path.extname(file.originalname),
          tamano_bytes: file.size,
        },
        { transaction },
      );
    }

    const participacionFinal = await Participacion.findByPk(id_participacion, {
      transaction,
    });

    if (!participacionFinal) {
      await transaction.rollback();
      return res.status(500).json({
        message: "Error al registrar la postulación",
      });
    }

    const usuario = await Usuario.findByPk(id_usuario);
    const participante = await UsuarioRol.findOne({
      where: {
        id_usuario: id_usuario,
        id_rol: 4,
      },
    });

    if (!participante) {
      await UsuarioRol.create({
        id_usuario: id_usuario,
        id_rol: 4,
      });
    }
    const edicion = await Edicion.findByPk(id_edicion);
    const edicionCategoria =
      await EdicionCategoria.findByPk(id_edicion_categoria);
    const categoria = await Categoria.findByPk(edicionCategoria.id_categoria);

    const convocatoria = await Convocatoria.findOne({
      where: {
        correo_electronico: usuario.correo_electronico,
        id_edicion,
      },
      transaction,
    });

    if (convocatoria) {
      await convocatoria.update(
        {
          id_participacion: participacionFinal.id_participacion,
          estado_envio: "postulado",
          fecha_respuesta: new Date(),
        },
        { transaction },
      );
    }

    await transaction.commit();

    const notificacion = await NotificacionService.crear({
      tipo: "REGISTRO_POSTULACION",
      titulo: "Postulación registrada correctamente",
      mensaje: `
        <p>Hola <b>${usuario.primer_nombre}</b>,</p>

        <p>Hemos recibido correctamente tu postulación a la edición
        <b>${edicion.nombre_edicion}</b>.</p>

        <p><b>Categoría:</b> ${categoria.nombre_categoria}</p>

        <p>Tu postulación será revisada por el comité organizador durante la etapa correspondiente. 
        Te notificaremos por este medio y por correo electrónico cualquier actualización sobre su estado.</p>

        <p>¡Gracias por participar en el <b>Premio Anual al Mérito Científico y Empresarial (PAMCE)</b>!</p>
      `,
      prioridad: "media",
      id_usuario: usuario.id_usuario,
      id_rol: 4,
      datos: {
        id_edicion: edicion.id_edicion,
        nombre_edicion: edicion.nombre_edicion,
        id_categoria: categoria.id_categoria,
        nombre_categoria: categoria.nombre_categoria,
        estado_postulacion: "Registrada",
      },
    });

    await NotificacionService.procesar(notificacion, ["sistema"], usuario);

    sendEmailConfirmacionPostulacion(
      usuario.correo_electronico,
      usuario.primer_nombre,
      edicion.nombre_edicion,
      categoria.nombre_categoria,
    );

    return res.status(201).json({
      message: "Postulación registrada correctamente",
      participacion: participacionFinal,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Error al registrar la postulación:", error);

    return res.status(500).json({
      message: "Error al registrar la postulación",
    });
  }
};

const agregaUsuarioPublico = async (req, res) => {
  try {
    const {
      numero_documento,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo_electronico,
      telefono,
      direccion,
      codigo_institucional,
      genero,
      nivel_estudio_superior,
      fecha_nacimiento,
    } = req.body;

    let usuario = await Usuario.findOne({
      where: { numero_documento },
    });

    if (usuario) {
      return res.status(409).json({
        message: "El número de documento ya está registrado.",
      });
    }

    const correoExistente = await Usuario.findOne({
      where: { correo_electronico },
    });

    if (correoExistente) {
      return res.status(400).json({
        message: "El correo electrónico ya está registrado",
      });
    }

    if (codigo_institucional) {
      const codigoExistente = await Usuario.findOne({
        where: { codigo_institucional },
      });

      if (codigoExistente) {
        return res.status(400).json({
          message: "El código institucional ya está registrado",
        });
      }
    }

    const telefonoExistente = await Usuario.findOne({
      where: { telefono },
    });

    if (telefonoExistente) {
      return res.status(400).json({
        message: "El número de teléfono ya está registrado",
      });
    }

    const nuevoUsuario = await Usuario.create({
      tipo_documento: "CC",
      numero_documento,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo_electronico,
      telefono,
      direccion,
      genero,
      fecha_nacimiento,
      nivel_estudio_superior,
      codigo_institucional,
      estado: "inactivo",
      contrasena: "contra_prueba",
      fecha_registro: new Date(),
      creo_contrasena: false,
    });

    const usuario_nuevo = await Usuario.findOne({
      where: {
        id_usuario: nuevoUsuario.id_usuario,
      },
      attributes: [
        "id_usuario",
        "tipo_documento",
        "numero_documento",
        "primer_nombre",
        "segundo_nombre",
        "primer_apellido",
        "segundo_apellido",
        "correo_electronico",
        "fecha_nacimiento",
        "telefono",
        "genero",
        "direccion",
        "fecha_registro",
        "nivel_estudio_superior",
        "fecha_actualizacion",
        "codigo_institucional",
      ],
    });

    const tokenCreacion = jwt.sign(
      {
        id_usuario: usuario_nuevo.id_usuario,
        id_rol: 4,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    await UsuarioToken.create({
      id_usuario: usuario_nuevo.id_usuario,
      token: tokenCreacion,
      usado: false,
      fecha_creacion: new Date(),
      fecha_expiracion: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const enlaceCreacion = `${process.env.FRONTEND_URL}/crear-clave/${tokenCreacion}`;

    await sendEmailCrearContrasena(
      usuario_nuevo.correo_electronico,
      usuario_nuevo.primer_nombre,
      enlaceCreacion,
    );

    return res.status(201).json({
      message: "Usuario registrado correctamente.",
      usuario: usuario_nuevo,
    });
  } catch (error) {
    console.error("Error al agregar participante:", error);

    return res.status(500).json({
      message: "Error en el servidor",
    });
  }
};

module.exports = {
  obtenerEdicionEnProcesoPublico,
  obtenerEdicionEnProcesoFanPage,
  obtenerEdicionesFanPage,
  obtenerUsuarioPorCedulaPublico,
  listarRequisitosEdicionPublico,
  listarCategoriasPorEdicionPublico,
  listarRequisitosCategoriaEdicionPublico,
  agregarParticipantePublico,
  registrarParticipacionPublico,
  agregaUsuarioPublico,
};

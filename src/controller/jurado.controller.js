const jwt = require("jsonwebtoken");
const { sendEmailCrearContrasena } = require("../configs/mail.config");
const {
  Usuario,
  Rol,
  UsuarioRol,
  Participacion,
  UsuarioToken,
  ParticipacionJurado,
  Edicion,
  EdicionCategoria,
  Categoria,
  EvaluacionCriterio,
  EdicionCategoriaRubricaCriterio,
} = require("../models");
const { Op, fn, col, where } = require("sequelize");
const { id, ca } = require("zod/locales");
const { setAuditContext } = require("../utils/audits");
const { hoyBogota } = require("../utils/fechas");
const sequelize = require("../configs/db");
const NotificacionService = require("../middlewares/notificaciones.js");

const listarJurados = async (req, res) => {
  try {
    const {
      search = "",
      genero,
      nivel_estudio_superior,
      estado,
      page,
      limit,
    } = req.query;

    const queryOptions = {
      where: {
        ...(search && {
          [Op.or]: [
            { numero_documento: { [Op.iLike]: `%${search}%` } },
            { primer_nombre: { [Op.iLike]: `%${search}%` } },
            { segundo_nombre: { [Op.iLike]: `%${search}%` } },
            { primer_apellido: { [Op.iLike]: `%${search}%` } },
            { segundo_apellido: { [Op.iLike]: `%${search}%` } },
            { correo_electronico: { [Op.iLike]: `%${search}%` } },
          ],
        }),
        ...(genero && genero !== "TODOS" && { genero }),
        ...(nivel_estudio_superior &&
          nivel_estudio_superior !== "TODOS" && {
            nivel_estudio_superior,
          }),
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: {
            id_rol: 3,
          },
          through: {
            where: {
              ...(estado &&
                estado !== "TODOS" && {
                  estado_rol: estado,
                }),
            },
          },
        },
      ],
      distinct: true,
    };

    if (page && limit) {
      queryOptions.order = [["id_usuario", "ASC"]];
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Usuario.findAndCountAll(queryOptions);

    return res.json({
      message: "Jurados obtenidos correctamente",
      jurados: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error("Error al obtener jurados:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const agregarJurado = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;

    await setAuditContext(sequelize, req, transaction);

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
      include: [
        {
          model: Rol,
          as: "roles",
        },
      ],
      transaction,
    });

    if (usuario) {
      if (
        usuario.roles?.some(
          (rol) => rol.id_rol === 3 && rol.UsuarioRol.estado_rol === "activo",
        )
      ) {
        await transaction.rollback();
        return res.status(400).json({
          message: "El usuario ya está registrado como jurado activo",
        });
      }
      if (
        usuario.roles?.some(
          (rol) => rol.id_rol === 3 && rol.UsuarioRol.estado_rol === "inactivo",
        )
      ) {
        await transaction.rollback();
        return res.status(400).json({
          message:
            "El usuario ya está registrado como jurado, pero su estado en el sistema es inactivo",
        });
      }
      await usuario.addRole(3, {
        through: { estado_rol: "activo" },
        transaction,
      });

      await transaction.commit();

      return res.status(200).json({
        message: "Rol de jurado asignado correctamente al usuario existente",
      });
    }

    const correoExistente = await Usuario.findOne({
      where: { correo_electronico },
      transaction,
    });

    if (correoExistente) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "El correo electrónico ya está registrado" });
    }

    if (codigo_institucional) {
      const codigoExistente = await Usuario.findOne({
        where: { codigo_institucional },
        transaction,
      });

      if (codigoExistente) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ message: "El código institucional ya está registrado" });
      }
    }

    const telefonoExistente = await Usuario.findOne({
      where: { telefono },
      transaction,
    });

    if (telefonoExistente) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "El número de teléfono ya está registrado" });
    }

    const nuevoUsuario = await Usuario.create(
      {
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
      },
      { transaction },
    );

    await nuevoUsuario.addRole(3, {
      through: { estado_rol: "inactivo" },
      transaction,
    });

    const jurado = await Usuario.findOne({
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
          where: { id_rol: 3 },
          attributes: ["id_rol", "nombre_rol"],
          through: {
            model: UsuarioRol,
            attributes: ["estado_rol", "fecha_registro", "fecha_actualizacion"],
          },
        },
      ],
      transaction,
    });

    const tokenCreacion = jwt.sign(
      { id_usuario: jurado.id_usuario, id_rol: 3 },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    await UsuarioToken.create(
      {
        id_usuario: nuevoUsuario.id_usuario,
        token: tokenCreacion,
        usado: false,
        fecha_creacion: new Date(),
        fecha_expiracion: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { transaction },
    );

    const enlaceCreacion = `${process.env.FRONTEND_URL}/crear-clave/${tokenCreacion}`;

    await sendEmailCrearContrasena(
      nuevoUsuario.correo_electronico,
      nuevoUsuario.primer_nombre,
      enlaceCreacion,
    );
    await transaction.commit();
    return res.status(201).json({
      message:
        "Usuario registrado correctamente y rol jurado asignado. Se envió un correo para que cree su contraseña.",
      usuario: jurado,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error al agregar jurado:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const editarInformacionJurado = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;

    await setAuditContext(sequelize, req, transaction);
    const { numero_documento } = req.params;
    const {
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

    const usuario = await Usuario.findOne({
      where: { numero_documento },
      transaction,
    });

    if (!usuario) {
      await transaction.rollback();
      return res.status(404).json({ message: "Jurado no encontrado" });
    }

    const cambios = {
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
    };

    const sinCambios = Object.keys(cambios).every((key) => {
      if (key === "fecha_nacimiento") {
        const fechaOriginal = usuario.fecha_nacimiento
          ? new Date(usuario.fecha_nacimiento).toISOString().split("T")[0]
          : null;
        const fechaNueva = cambios.fecha_nacimiento
          ? new Date(cambios.fecha_nacimiento).toISOString().split("T")[0]
          : null;
        return fechaOriginal === fechaNueva;
      }
      return usuario[key] === cambios[key];
    });

    const existente = await Usuario.findOne({
      where: {
        id_usuario: {
          [Op.ne]: usuario.id_usuario,
        },

        [Op.or]: [
          {
            correo_electronico: cambios.correo_electronico,
          },
          {
            telefono: cambios.telefono,
          },
        ],
      },

      transaction,
    });

    if (existente) {
      return res.status(400).json({
        message:
          "No se puede editar. Datos de contacto ya existentes en el sistema",
      });
    }

    const jurado = await Usuario.findOne({
      where: {
        id_usuario: usuario.id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 3 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
      transaction,
    });

    if (sinCambios) {
      await transaction.rollback();
      return res.status(201).json({
        message: "No realizaste cambios al jurado",
        jurado,
        status: 201,
      });
    }

    await usuario.update(
      {
        ...cambios,
        fecha_actualizacion: new Date(),
      },
      { transaction },
    );

    const juradoActualizado = await Usuario.findOne({
      where: {
        id_usuario: usuario.id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 3 },
          attributes: ["id_rol", "nombre_rol"],
          through: {
            model: UsuarioRol,
            attributes: ["estado_rol", "fecha_registro", "fecha_actualizacion"],
          },
        },
      ],
      transaction,
    });

    await transaction.commit();
    return res.status(200).json({
      message: "Información del jurado actualizada correctamente",
      jurado: juradoActualizado,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error al editar información de jurado:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const cambiarEstadoJurado = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { numero_documento, estado } = req.body.datos;

    req.audit.usuario_id = req.user.data.id_usuario;

    if (estado === "activo") {
      req.audit.metodo = "ACTIVATE";
    } else if (estado === "inactivo") {
      req.audit.metodo = "INACTIVE";
    } else {
      req.audit.metodo = "CHANGE_STATE";
    }

    await setAuditContext(sequelize, req, transaction);

    const usuario = await Usuario.findOne({
      where: { numero_documento },
      transaction,
    });

    if (!usuario) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    const jurado = await Usuario.findOne({
      where: {
        id_usuario: usuario.id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 3 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
      transaction,
    });

    if (!jurado) {
      await transaction.rollback();

      return res.status(404).json({
        message: "El usuario no tiene asignado el rol de jurado",
      });
    }

    const edicionEnProceso = await Edicion.findOne({
      where: {
        estado_edicion: "en_proceso",
      },
      transaction,
    });

    if (edicionEnProceso) {
      const participacionesAsignadasActivas = await ParticipacionJurado.findAll(
        {
          where: {
            id_jurado: jurado.id_usuario,
            estado: "asignado",
          },
          include: [
            {
              model: Participacion,
              as: "participacion",
              include: [
                {
                  model: Edicion,
                  as: "edicion",
                  where: {
                    id_edicion: edicionEnProceso.id_edicion,
                  },
                },
              ],
            },
          ],
          transaction,
        },
      );

      if (participacionesAsignadasActivas.length > 0) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            "No se puede cambiar el estado. El jurado tiene evaluaciones pendientes",
        });
      }
    }

    await UsuarioRol.update(
      {
        estado_rol: estado === "activo" ? "activo" : "inactivo",
        fecha_actualizacion: new Date(),
      },
      {
        where: {
          id_usuario: jurado.id_usuario,
          id_rol: 3,
        },
        transaction,
      },
    );

    const juradoActualizado = await Usuario.findOne({
      where: {
        id_usuario: jurado.id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 3 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      message: "Estado del jurado actualizado correctamente",
      jurado: juradoActualizado,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Error al cambiar estado de jurado:", error);

    return res.status(500).json({
      message: "Error en el servidor",
    });
  }
};

const obtenerJurado = async (req, res) => {
  try {
    const { id_usuario } = req.params;

    const jurado = await Usuario.findOne({
      where: {
        id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 3 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
    });

    return res.json({
      message: "Jurado obtenido correctamente",
      jurado,
    });
  } catch (error) {
    console.error("Error al obtener jurado:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const listarJuradosPorEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;
    const {
      search = "",
      genero,
      nivel_estudio_superior,
      page,
      limit,
    } = req.query;

    const queryOptions = {
      include: [
        {
          model: ParticipacionJurado,
          as: "evaluacionesAsignadas",
          required: true,
          include: [
            {
              model: Participacion,
              as: "participacion",
              required: true,
              where: {
                id_edicion: id_edicion,
              },
            },
          ],
        },
        {
          model: Rol,
          as: "roles",
          required: true,
          where: { id_rol: 3 },
        },
      ],
      where: {
        ...(search && {
          [Op.or]: [
            { numero_documento: { [Op.iLike]: `%${search}%` } },
            { primer_nombre: { [Op.iLike]: `%${search}%` } },
            { segundo_nombre: { [Op.iLike]: `%${search}%` } },
            { primer_apellido: { [Op.iLike]: `%${search}%` } },
            { segundo_apellido: { [Op.iLike]: `%${search}%` } },
            { correo_electronico: { [Op.iLike]: `%${search}%` } },
          ],
        }),
        ...(genero && genero !== "TODOS" && { genero }),
        ...(nivel_estudio_superior &&
          nivel_estudio_superior !== "TODOS" && {
            nivel_estudio_superior,
          }),
      },
      distinct: true,
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Usuario.findAndCountAll(queryOptions);

    return res.json({
      message: "Jurados obtenidos correctamente",
      jurados: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarJuradosPorCategoriaEdicion = async (req, res) => {
  try {
    const { id_edicion_categoria } = req.params;
    const {
      search = "",
      genero,
      nivel_estudio_superior,
      page,
      limit,
    } = req.query;

    const queryOptions = {
      include: [
        {
          model: ParticipacionJurado,
          as: "evaluacionesAsignadas",
          required: true,
          include: [
            {
              model: Participacion,
              as: "participacion",
              required: true,
              where: {
                id_edicion_categoria: id_edicion_categoria,
              },
            },
          ],
        },
        {
          model: Rol,
          as: "roles",
          required: true,
          where: { id_rol: 3 },
        },
      ],
      where: {
        ...(search && {
          [Op.or]: [
            { numero_documento: { [Op.iLike]: `%${search}%` } },
            { primer_nombre: { [Op.iLike]: `%${search}%` } },
            { segundo_nombre: { [Op.iLike]: `%${search}%` } },
            { primer_apellido: { [Op.iLike]: `%${search}%` } },
            { segundo_apellido: { [Op.iLike]: `%${search}%` } },
            { correo_electronico: { [Op.iLike]: `%${search}%` } },
          ],
        }),
        ...(genero && genero !== "TODOS" && { genero }),
        ...(nivel_estudio_superior &&
          nivel_estudio_superior !== "TODOS" && {
            nivel_estudio_superior,
          }),
      },
      distinct: true,
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.order = [["id_usuario", "ASC"]];
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Usuario.findAndCountAll(queryOptions);

    return res.json({
      mensaje: "Jurados obtenidos correctamente",
      jurados: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarJuradosDisponiblesAsignar = async (req, res) => {
  try {
    const { id_edicion } = req.params;
    const { search = "" } = req.query;

    const participaciones = await Participacion.findAll({
      where: {
        id_edicion,
      },
      attributes: ["id_usuario"],
      raw: true,
    });

    const usuariosParticipantes = participaciones.map(
      (participacion) => participacion.id_usuario,
    );

    const queryOptions = {
      where: {
        ...(usuariosParticipantes.length > 0 && {
          id_usuario: {
            [Op.notIn]: usuariosParticipantes,
          },
        }),
        ...(search && {
          [Op.or]: [
            { numero_documento: { [Op.iLike]: `%${search}%` } },
            { primer_nombre: { [Op.iLike]: `%${search}%` } },
            { segundo_nombre: { [Op.iLike]: `%${search}%` } },
            { primer_apellido: { [Op.iLike]: `%${search}%` } },
            { segundo_apellido: { [Op.iLike]: `%${search}%` } },
            { correo_electronico: { [Op.iLike]: `%${search}%` } },
          ],
        }),
      },

      include: [
        {
          model: Rol,
          as: "roles",
          where: {
            id_rol: 3,
          },
          through: {
            where: {
              estado_rol: "activo",
            },
          },
        },
      ],

      distinct: true,

      order: [["id_usuario", "ASC"]],
    };

    const jurados = await Usuario.findAll(queryOptions);

    return res.json({
      message: "Jurados obtenidos correctamente",
      jurados,
    });
  } catch (error) {
    console.error("Error al obtener jurados:", error);

    return res.status(500).json({
      message: "Error en el servidor",
    });
  }
};

const obtenerEdicionesParticipacionJurado = async (req, res) => {
  try {
    const { id_jurado } = req.params;
    const { search = "", estado, mes, anio } = req.query;

    let conditions = [];

    if (search) {
      conditions.push({
        [Op.or]: [{ nombre_edicion: { [Op.iLike]: `%${search}%` } }],
      });
    }

    if (estado && estado !== "TODOS") {
      conditions.push({ estado_edicion: estado });
    }

    if (anio && anio !== "TODOS") {
      const startYear = `${anio}-01-01`;
      const endYear = `${anio}-12-31`;

      conditions.push({
        [Op.or]: [
          { fecha_inicio: { [Op.between]: [startYear, endYear] } },
          { fecha_fin: { [Op.between]: [startYear, endYear] } },
        ],
      });
    }

    if (mes && mes !== "TODOS") {
      const month = parseInt(mes, 10);

      if (anio && anio !== "TODOS") {
        const monthStr = mes.toString().padStart(2, "0");
        const startMonth = `${anio}-${monthStr}-01`;
        const endMonth = `${anio}-${monthStr}-31`;

        conditions.push({
          [Op.or]: [
            { fecha_inicio: { [Op.between]: [startMonth, endMonth] } },
            { fecha_fin: { [Op.between]: [startMonth, endMonth] } },
          ],
        });
      } else {
        conditions.push({
          [Op.or]: [
            where(fn("date_part", "month", col("fecha_inicio")), month),
            where(fn("date_part", "month", col("fecha_fin")), month),
          ],
        });
      }
    }

    const whereClause = conditions.length > 0 ? { [Op.and]: conditions } : {};

    const ediciones = await Edicion.findAll({
      where: whereClause,
      include: [
        {
          model: Participacion,
          as: "participaciones",
          required: true,
          include: [
            {
              model: ParticipacionJurado,
              as: "juradosAsignados",
              where: { id_jurado },
              required: true,
            },
          ],
        },
      ],
      distinct: true,
    });

    return res.json({
      message: "Ediciones obtenidas correctamente",
      ediciones,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerCategoriasEdicionesParticipacionJurado = async (req, res) => {
  try {
    const { id_jurado, id_edicion } = req.params;

    const categorias = await Categoria.findAll({
      include: [
        {
          model: EdicionCategoria,
          as: "edicionesCategoria",
          required: true,
          include: [
            {
              model: Participacion,
              as: "participaciones",
              where: { id_edicion },
              required: true,
              include: [
                {
                  model: ParticipacionJurado,
                  as: "juradosAsignados",
                  where: { id_jurado },
                  required: true,
                },
              ],
            },
          ],
        },
      ],
    });

    return res.json({
      message: "Categorias obtenidas correctamente",
      categorias,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerParticipacionesEvaluadasJurado = async (req, res) => {
  try {
    const { id_jurado } = req.params;
    const { search = "", edicion, categoria, genero, page, limit } = req.query;

    const queryOptions = {
      include: [
        {
          model: ParticipacionJurado,
          as: "juradosAsignados",
          where: { id_jurado },
          required: true,
        },
        {
          model: Usuario,
          as: "usuario",
          where: {
            ...(genero && genero !== "TODOS" && { genero }),
            ...(search && {
              [Op.or]: [
                { numero_documento: { [Op.iLike]: `%${search}%` } },
                { primer_nombre: { [Op.iLike]: `%${search}%` } },
                { segundo_nombre: { [Op.iLike]: `%${search}%` } },
                { primer_apellido: { [Op.iLike]: `%${search}%` } },
                { segundo_apellido: { [Op.iLike]: `%${search}%` } },
                { correo_electronico: { [Op.iLike]: `%${search}%` } },
              ],
            }),
          },
          required: true,
        },
        {
          model: Edicion,
          as: "edicion",
          where: {
            ...(edicion && edicion !== "TODOS" && { id_edicion: edicion }),
          },
          required: true,
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          where: {
            ...(categoria &&
              categoria !== "TODOS" && { id_edicion_categoria: categoria }),
          },
          required: true,
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
          ],
        },
      ],
      distinct: true,
    };

    if (page && limit) {
      queryOptions.order = [["id_participacion", "ASC"]];
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Participacion.findAndCountAll(queryOptions);

    return res.json({
      message: "Participaciones obtenidas correctamente",
      participaciones: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerParticipacionesEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;
    const { id_jurado, search = "", categoria, page, limit } = req.query;

    const options = {
      where: {
        id_jurado,
      },
      include: [
        {
          model: Participacion,
          as: "participacion",
          where: {
            id_edicion,
          },
          include: [
            {
              model: EdicionCategoria,
              as: "edicionCategoria",
              where: {
                ...(categoria &&
                  categoria !== "TODOS" && {
                    id_edicion_categoria: categoria,
                  }),
              },
              include: [
                {
                  model: Categoria,
                  as: "categoria",
                },
              ],
            },
            {
              model: Usuario,
              as: "usuario",
              where: {
                ...(search && {
                  [Op.or]: [
                    { numero_documento: { [Op.iLike]: `%${search}%` } },
                    { primer_nombre: { [Op.iLike]: `%${search}%` } },
                    { segundo_nombre: { [Op.iLike]: `%${search}%` } },
                    { primer_apellido: { [Op.iLike]: `%${search}%` } },
                    { segundo_apellido: { [Op.iLike]: `%${search}%` } },
                  ],
                }),
              },
            },
          ],
        },
      ],
      distinct: true,
    };

    if (page && limit) {
      const pageNumber = Number(page);
      const limitNumber = Number(limit);

      options.limit = limitNumber;
      options.offset = (pageNumber - 1) * limitNumber;
    }

    const { count, rows } = await ParticipacionJurado.findAndCountAll(options);

    return res.json({
      mensaje: "Participaciones obtenidas correctamente",
      participaciones: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const CALIFICACION_MINIMA = 0;
const CALIFICACION_MAXIMA = 5;

// Reglas comunes para registrar o editar una evaluación.
// Devuelve { status, message } si algo no se cumple, o null si todo está bien.
const validarEvaluacionJurado = ({
  req,
  participacionJurado,
  evaluaciones,
  idsCriteriosConfigurados,
  estadosPermitidos,
}) => {
  if (participacionJurado.id_jurado !== req.user.data.id_usuario) {
    return {
      status: 403,
      message: "Esta participación no está asignada a tu usuario.",
    };
  }

  if (!estadosPermitidos.includes(participacionJurado.estado)) {
    return {
      status: 400,
      message: `No es posible evaluar: la asignación está en estado "${participacionJurado.estado}".`,
    };
  }

  const edicion = participacionJurado.participacion.edicionCategoria.edicion;
  const hoy = hoyBogota();

  if (
    edicion.estado_edicion !== "en_proceso" ||
    edicion.fecha_procesamiento_premiacion ||
    hoy < String(edicion.fecha_inicio_evaluacion) ||
    hoy > String(edicion.fecha_fin_evaluacion)
  ) {
    return {
      status: 400,
      message: "Solo se puede evaluar durante la etapa de evaluación.",
    };
  }

  const criterioAjeno = evaluaciones.find(
    (evaluacion) =>
      !idsCriteriosConfigurados.includes(Number(evaluacion.id_ecrc)),
  );

  if (criterioAjeno) {
    return {
      status: 400,
      message: `El criterio ${criterioAjeno.id_ecrc} no pertenece a la rúbrica de esta categoría.`,
    };
  }

  const fueraDeRango = evaluaciones.find((evaluacion) => {
    const nota = Number(evaluacion.calificacion);
    return (
      !Number.isFinite(nota) ||
      nota < CALIFICACION_MINIMA ||
      nota > CALIFICACION_MAXIMA
    );
  });

  if (fueraDeRango) {
    return {
      status: 400,
      message: `Las calificaciones deben estar entre ${CALIFICACION_MINIMA} y ${CALIFICACION_MAXIMA}.`,
    };
  }

  return null;
};

const registrarEvaluacion = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    req.audit.usuario_id = req.user.data.id_usuario;

    await setAuditContext(sequelize, req, transaction);

    const { id_participacion_jurado, observacion_general, evaluaciones } =
      req.body;

    if (!id_participacion_jurado) {
      await transaction.rollback();

      return res.status(400).json({
        message: "No se recibió la participación del jurado.",
      });
    }

    if (!Array.isArray(evaluaciones) || evaluaciones.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        message: "No se recibieron criterios para evaluar.",
      });
    }

    const participacionJurado = await ParticipacionJurado.findByPk(
      id_participacion_jurado,
      {
        include: [
          {
            model: Participacion,
            as: "participacion",
            required: true,
            include: [
              {
                model: EdicionCategoria,
                as: "edicionCategoria",
                required: true,
                include: [
                  {
                    model: Edicion,
                    as: "edicion",
                    required: true,
                  },
                  {
                    model: Categoria,
                    as: "categoria",
                    required: true,
                  },
                ],
              },
              {
                model: Usuario,
                as: "usuario",
                required: true,
              },
            ],
          },
          {
            model: Usuario,
            as: "jurado",
            required: true,
          },
        ],
        transaction,
      },
    );

    if (!participacionJurado) {
      await transaction.rollback();

      return res.status(404).json({
        message: "No se encontró la asignación del jurado.",
      });
    }

    if (participacionJurado.estado === "evaluado") {
      await transaction.rollback();

      return res.status(400).json({
        message: "Esta participación ya ha sido evaluada.",
      });
    }

    const id_edicion_categoria =
      participacionJurado.participacion.edicionCategoria.id_edicion_categoria;

    const criteriosConfigurados = await EdicionCategoriaRubricaCriterio.findAll(
      {
        where: {
          id_edicion_categoria,
        },
        transaction,
      },
    );

    const idsCriteriosConfigurados = criteriosConfigurados.map(
      (criterio) => criterio.id_ecrc,
    );

    const errorValidacion = validarEvaluacionJurado({
      req,
      participacionJurado,
      evaluaciones,
      idsCriteriosConfigurados,
      estadosPermitidos: ["asignado"],
    });

    if (errorValidacion) {
      await transaction.rollback();

      return res
        .status(errorValidacion.status)
        .json({ message: errorValidacion.message });
    }

    const criteriosFaltantes = idsCriteriosConfigurados.filter(
      (id) =>
        !evaluaciones.some(
          (evaluacion) => Number(evaluacion.id_ecrc) === Number(id),
        ),
    );

    if (criteriosFaltantes.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        message: `Faltan ${criteriosFaltantes.length} criterios por evaluar.`,
        criteriosFaltantes,
      });
    }

    const criterioSinCalificacion = evaluaciones.find(
      (evaluacion) =>
        evaluacion.calificacion === undefined ||
        evaluacion.calificacion === null ||
        evaluacion.calificacion === "",
    );

    if (criterioSinCalificacion) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Todos los criterios deben tener una calificación.",
      });
    }

    const idsRecibidos = evaluaciones.map((evaluacion) =>
      Number(evaluacion.id_ecrc),
    );

    const idsUnicos = new Set(idsRecibidos);

    if (idsUnicos.size !== idsRecibidos.length) {
      await transaction.rollback();

      return res.status(400).json({
        message: "La evaluación contiene criterios duplicados.",
      });
    }

    // Bloquea la asignación para que dos envíos simultáneos no dupliquen notas
    await ParticipacionJurado.findByPk(id_participacion_jurado, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    const evaluacionesExistentes = await EvaluacionCriterio.findAll({
      where: {
        id_participacion_jurado,
      },
      transaction,
    });

    if (evaluacionesExistentes.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Esta participación ya tiene una evaluación registrada.",
      });
    }

    const registrosEvaluacion = evaluaciones.map((evaluacion) => ({
      id_participacion_jurado,

      id_edicion_categoria_rubrica_criterio: Number(evaluacion.id_ecrc),

      calificacion: evaluacion.calificacion,

      observacion: evaluacion.observacion || null,

      fecha_evaluacion: new Date(),
    }));

    const evaluacionesCreadas = await EvaluacionCriterio.bulkCreate(
      registrosEvaluacion,
      {
        transaction,
      },
    );

    const criteriosEvaluados = await EvaluacionCriterio.count({
      where: {
        id_participacion_jurado,
      },
      transaction,
    });

    const evaluacionCompleta =
      criteriosEvaluados === criteriosConfigurados.length;

    if (evaluacionCompleta) {
      await ParticipacionJurado.update(
        {
          observacion: observacion_general,
          fecha_evaluacion: new Date(),
          estado: "evaluado",
        },
        {
          where: {
            id_participacion_jurado,
          },
          transaction,
        },
      );

      const notificacion = await NotificacionService.crear({
        tipo: "EVALUACION_COMPLETADA",
        titulo: "Evaluación completada",

        mensaje: `
            <p>
              Te informamos que el jurado
              <b>
                ${participacionJurado.jurado.primer_nombre}
                ${participacionJurado.jurado.primer_apellido}
              </b>
              ha finalizado la evaluación de tu participación
              en la edición
              <b>
                ${
                  participacionJurado.participacion.edicionCategoria.edicion
                    .nombre_edicion
                }
              </b>
              en la categoría
              <b>
                ${
                  participacionJurado.participacion.edicionCategoria.categoria
                    .nombre_categoria
                }
              </b>.
            </p>

            <p>
              La evaluación ha sido registrada correctamente.
            </p>

            <p>
              Los resultados finales estarán disponibles
              una vez finalice la etapa de evaluación.
            </p>
          `,

        id_usuario: participacionJurado.participacion.usuario.id_usuario,

        prioridad: "media",

        id_rol: 4,

        datos: {
          id_participacion: participacionJurado.participacion.id_participacion,

          id_participacion_jurado,

          id_edicion_categoria,
        },
      });

      await NotificacionService.procesar(
        notificacion,
        ["sistema"],
        participacionJurado.participacion.usuario,
      );
    }

    await transaction.commit();

    return res.json({
      message: "Evaluación registrada correctamente.",
      evaluaciones: evaluacionesCreadas,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Error al registrar evaluación:", error);

    return res.status(500).json({
      error: "Error en el servidor.",
    });
  }
};

const editarEvaluacion = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_participacion_jurado, observacion_general, evaluaciones } =
      req.body;

    if (!id_participacion_jurado) {
      await transaction.rollback();

      return res.status(400).json({
        message: "No se recibió la participación del jurado.",
      });
    }

    if (!Array.isArray(evaluaciones) || evaluaciones.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        message: "No se recibieron criterios para actualizar.",
      });
    }

    const participacionJurado = await ParticipacionJurado.findByPk(
      id_participacion_jurado,
      {
        include: [
          {
            model: Participacion,
            as: "participacion",
            required: true,
            include: [
              {
                model: EdicionCategoria,
                as: "edicionCategoria",
                required: true,
                include: [
                  {
                    model: Edicion,
                    as: "edicion",
                    required: true,
                  },
                  {
                    model: Categoria,
                    as: "categoria",
                    required: true,
                  },
                ],
              },
              {
                model: Usuario,
                as: "usuario",
                required: true,
              },
            ],
          },
          {
            model: Usuario,
            as: "jurado",
            required: true,
          },
        ],
        transaction,
      },
    );

    if (!participacionJurado) {
      await transaction.rollback();

      return res.status(404).json({
        message: "No se encontró la asignación del jurado.",
      });
    }

    const id_edicion_categoria =
      participacionJurado.participacion.edicionCategoria.id_edicion_categoria;

    const criteriosConfigurados = await EdicionCategoriaRubricaCriterio.findAll(
      {
        where: {
          id_edicion_categoria,
        },
        transaction,
      },
    );

    const idsCriteriosConfigurados = criteriosConfigurados.map(
      (criterio) => criterio.id_ecrc,
    );

    const errorValidacion = validarEvaluacionJurado({
      req,
      participacionJurado,
      evaluaciones,
      idsCriteriosConfigurados,
      estadosPermitidos: ["asignado", "evaluado"],
    });

    if (errorValidacion) {
      await transaction.rollback();

      return res
        .status(errorValidacion.status)
        .json({ message: errorValidacion.message });
    }

    const criteriosFaltantes = idsCriteriosConfigurados.filter(
      (id) =>
        !evaluaciones.some(
          (evaluacion) => Number(evaluacion.id_ecrc) === Number(id),
        ),
    );

    if (criteriosFaltantes.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        message: `Faltan ${criteriosFaltantes.length} criterios por evaluar.`,
        criteriosFaltantes,
      });
    }

    const criterioSinCalificacion = evaluaciones.find(
      (evaluacion) =>
        evaluacion.calificacion === undefined ||
        evaluacion.calificacion === null ||
        evaluacion.calificacion === "",
    );

    if (criterioSinCalificacion) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Todos los criterios deben tener una calificación.",
      });
    }

    const idsRecibidos = evaluaciones.map((evaluacion) =>
      Number(evaluacion.id_ecrc),
    );

    const idsUnicos = new Set(idsRecibidos);

    if (idsUnicos.size !== idsRecibidos.length) {
      await transaction.rollback();

      return res.status(400).json({
        message: "La evaluación contiene criterios duplicados.",
      });
    }

    const evaluacionesExistentes = await EvaluacionCriterio.findAll({
      where: {
        id_participacion_jurado,
      },
      transaction,
    });

    if (evaluacionesExistentes.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        message: "No se encontraron evaluaciones para actualizar.",
      });
    }

    for (const evaluacion of evaluaciones) {
      const evaluacionExistente = evaluacionesExistentes.find(
        (item) =>
          Number(item.id_edicion_categoria_rubrica_criterio) ===
          Number(evaluacion.id_ecrc),
      );

      if (!evaluacionExistente) {
        await transaction.rollback();

        return res.status(404).json({
          message: `No se encontró la evaluación del criterio ${evaluacion.id_ecrc}.`,
        });
      }

      await evaluacionExistente.update(
        {
          calificacion: evaluacion.calificacion,
          observacion: evaluacion.observacion || null,
          fecha_evaluacion: new Date(),
        },
        {
          transaction,
        },
      );
    }

    await ParticipacionJurado.update(
      {
        observacion: observacion_general,
        fecha_evaluacion: new Date(),
        estado: "evaluado",
      },
      {
        where: {
          id_participacion_jurado,
        },
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      message: "Evaluación actualizada correctamente.",
      evaluaciones,
      criteriosEvaluados: evaluaciones.length,
      evaluacionCompleta: evaluaciones.length === criteriosConfigurados.length,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Error al actualizar la evaluación:", error);

    return res.status(500).json({
      error: "Error en el servidor.",
    });
  }
};

module.exports = {
  listarJurados,
  agregarJurado,
  editarInformacionJurado,
  cambiarEstadoJurado,
  obtenerJurado,
  listarJuradosPorEdicion,
  listarJuradosPorCategoriaEdicion,
  obtenerEdicionesParticipacionJurado,
  obtenerCategoriasEdicionesParticipacionJurado,
  obtenerParticipacionesEvaluadasJurado,
  obtenerParticipacionesEdicion,
  listarJuradosDisponiblesAsignar,
  registrarEvaluacion,
  editarEvaluacion,
};

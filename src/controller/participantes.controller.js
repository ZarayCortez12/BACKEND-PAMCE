const jwt = require("jsonwebtoken");
const { sendEmailCrearContrasena } = require("../configs/mail.config");
const {
  Participacion,
  Usuario,
  Rol,
  UsuarioRol,
  UsuarioToken,
  Edicion,
  EdicionCategoria,
  Categoria,
  Convocatoria,
  ParticipacionJurado,
} = require("../models");
const { response } = require("express");
const { Op, fn, col, where } = require("sequelize");
const { id, ca, es } = require("zod/locales");
const { setAuditContext } = require("../utils/audits");
const sequelize = require("../configs/db");
const { generarCertificado } = require("../middlewares/pdfCertificado");
const dayjs = require("dayjs");

const listarParticipantes = async (req, res) => {
  try {
    const {
      search = "",
      genero,
      nivel_estudio_superior,
      estado,
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows } = await Usuario.findAndCountAll({
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
            id_rol: 4,
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
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    return res.json({
      message: "Participantes obtenidos correctamente",
      participantes: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error al obtener participantes:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const agregarParticipante = async (req, res) => {
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
          (rol) => rol.id_rol === 4 && rol.UsuarioRol.estado_rol === "activo",
        )
      ) {
        await transaction.rollback();
        return res.status(400).json({
          message: "El usuario ya está registrado como participante activo",
        });
      }
      if (
        usuario.roles?.some(
          (rol) => rol.id_rol === 4 && rol.UsuarioRol.estado_rol === "inactivo",
        )
      ) {
        await transaction.rollback();
        return res.status(400).json({
          message:
            "El usuario ya está registrado como participante, pero su estado en el sistema es inactivo",
        });
      }

      await usuario.addRole(4, {
        through: { estado_rol: "activo" },
        transaction,
      });

      await transaction.commit();

      return res.status(200).json({
        message:
          "Rol de participante asignado correctamente al usuario existente",
        usuario,
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

    await nuevoUsuario.addRole(4, {
      through: { estado_rol: "inactivo" },
      transaction,
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
      transaction,
    });

    const tokenCreacion = jwt.sign(
      { id_usuario: participante.id_usuario, id_rol: 4 },
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
        "Usuario registrado correctamente y rol participante asignado. Se envió un correo para que cree su contraseña.",
      usuario: participante,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error al agregar participante:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const editarInformacionParticipante = async (req, res) => {
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
      return res.status(404).json({ message: "Participante no encontrado" });
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

    const participante = await Usuario.findOne({
      where: {
        id_usuario: usuario.id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 4 },
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
        message: "No realizaste cambios al participante",
        participante,
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

    const participanteActualizado = await Usuario.findOne({
      where: {
        id_usuario: usuario.id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 4 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
      transaction,
    });

    await transaction.commit();
    return res.status(200).json({
      message: "Información del participante actualizada correctamente",
      participante: participanteActualizado,
    });
  } catch (error) {
    console.error("Error al editar información de participante:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const cambiarEstadoParticipante = async (req, res) => {
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
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const participante = await Usuario.findOne({
      where: {
        id_usuario: usuario.id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 4 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
      transaction,
    });

    const tieneParticipaciones = await Participacion.findOne({
      where: { id_usuario: participante.id_usuario },
      transaction,
    });

    if (tieneParticipaciones) {
      return res.status(400).json({
        message:
          "No se puede cambiar el estado. El usuario tiene participaciones registradas en la edición en proceso",
      });
    }

    if (estado === "activo") {
      await UsuarioRol.update(
        {
          estado_rol: "activo",
          fecha_actualizacion: new Date(),
        },
        {
          where: {
            id_usuario: participante.id_usuario,
            id_rol: 4,
          },
          transaction,
        },
      );
    } else {
      await UsuarioRol.update(
        {
          estado_rol: "inactivo",
          fecha_actualizacion: new Date(),
        },
        {
          where: {
            id_usuario: participante.id_usuario,
            id_rol: 4,
          },
          transaction,
        },
      );
    }

    const participanteActualizado = await Usuario.findOne({
      where: {
        id_usuario: participante.id_usuario,
      },
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
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      message: "Estado del participante actualizado correctamente",
      participante: participanteActualizado,
    });
  } catch (error) {
    console.error("Error al cambiar estado de participante:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const obtenerParticipante = async (req, res) => {
  try {
    const { id_usuario } = req.params;

    const participante = await Usuario.findOne({
      where: {
        id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 4 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
    });

    return res.json({
      message: "Participante obtenido correctamente",
      participante,
    });
  } catch (error) {
    console.error("Error al obtener participante:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const obtenerEdicionesParticipacionParticipante = async (req, res) => {
  try {
    const { id_participante } = req.params;

    const ediciones = await Edicion.findAll({
      include: [
        {
          model: Participacion,
          as: "participaciones",
          where: { id_usuario: id_participante },
          required: true,
        },
      ],
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

const obtenerCategoriasEdicionesParticipacionParticipante = async (
  req,
  res,
) => {
  try {
    const { id_participante, id_edicion } = req.params;

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
              where: { id_edicion, id_usuario: id_participante },
              required: true,
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

const obtenerParticipaciones = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { edicion, categoria, estado, page, limit } = req.query;

    const queryOptions = {
      where: {
        id_usuario,
        ...(estado && estado !== "TODOS" && { estado }),
      },
      include: [
        {
          model: Edicion,
          as: "edicion",
          where: {
            ...(edicion && edicion !== "TODOS" && { id_edicion: edicion }),
          },
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          where: {
            ...(categoria &&
              categoria !== "TODOS" && { id_categoria: categoria }),
          },
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
    console.error("Error al obtener participaciones:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const obtenerConvocatoriasParticipante = async (req, res) => {
  try {
    const { id_participante } = req.params;
    const { edicion, estado, page, limit } = req.query;

    const participante = await Usuario.findOne({
      where: {
        id_usuario: id_participante,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 4 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
    });

    const queryOptions = {
      where: {
        correo_electronico: participante.correo_electronico,
        ...(estado && estado !== "TODOS" && { estado_envio: estado }),
      },
      include: [
        {
          model: Edicion,
          as: "edicion",
          where: {
            ...(edicion && edicion !== "TODOS" && { id_edicion: edicion }),
          },
        },
      ],
      distinct: true,
    };

    if (page && limit) {
      queryOptions.order = [["id_convocatoria", "DESC"]];
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Convocatoria.findAndCountAll(queryOptions);

    return res.json({
      message: "Convocatorias obtenidas correctamente",
      convocatorias: rows,
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

const obtenerParticipacionesPorJurado = async (req, res) => {
  try {
    const { id_jurado } = req.params;
    const {
      search = "",
      categoria,
      edicion,
      genero,
      nivel_estudio_superior,
      page,
      limit,
    } = req.query;

    const options = {
      where: {
        id_jurado,
        estado: "evaluado",
      },

      include: [
        {
          model: Participacion,
          as: "participacion",
          required: true,
          include: [
            {
              model: Edicion,
              as: "edicion",
              required: true,
              where: {
                estado_edicion: {
                  [Op.ne]: "en_proceso",
                },
                ...(edicion && edicion !== "TODOS" && { id_edicion: edicion }),
              },
            },
            {
              model: Usuario,
              as: "usuario",
              required: true,
              where: {
                ...(search && {
                  [Op.or]: [
                    {
                      numero_documento: {
                        [Op.iLike]: `%${search}%`,
                      },
                    },
                    {
                      primer_nombre: {
                        [Op.iLike]: `%${search}%`,
                      },
                    },
                    {
                      segundo_nombre: {
                        [Op.iLike]: `%${search}%`,
                      },
                    },
                    {
                      primer_apellido: {
                        [Op.iLike]: `%${search}%`,
                      },
                    },
                    {
                      segundo_apellido: {
                        [Op.iLike]: `%${search}%`,
                      },
                    },
                  ],
                }),

                ...(genero &&
                  genero !== "TODOS" && {
                    genero,
                  }),
                ...(nivel_estudio_superior &&
                  nivel_estudio_superior !== "TODOS" && {
                    nivel_estudio_superior,
                  }),
              },
            },

            {
              model: EdicionCategoria,
              as: "edicionCategoria",
              required: true,

              include: [
                {
                  model: Categoria,
                  as: "categoria",
                  required: true,
                  where: {
                    ...(categoria &&
                      categoria !== "TODOS" && { id_categoria: categoria }),
                  },
                },
              ],
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

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const obtenerEdicionesPorParticipante = async (req, res) => {
  try {
    const { id_participante } = req.params;
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
        const endMonth = `${anio}-${monthStr}-${new Date(Number(anio), Number(monthStr), 0).getDate()}`;

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
          where: { id_usuario: id_participante },
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

const obtenerParticipacionesPorParticipante = async (req, res) => {
  try {
    const { id_participante } = req.params;
    const { edicion, categoria, estado } = req.query;

    const queryOptions = {
      where: {
        id_usuario,
        ...(estado && estado !== "TODOS" && { estado }),
      },
      include: [
        {
          model: Edicion,
          as: "edicion",
          where: {
            ...(edicion && edicion !== "TODOS" && { id_edicion: edicion }),
          },
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          where: {
            ...(categoria &&
              categoria !== "TODOS" && { id_categoria: categoria }),
          },
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

    const participaciones = await Participacion.findAndCountAll(queryOptions);

    return res.json({
      message: "Participaciones obtenidas correctamente",
      participaciones,
    });
  } catch (error) {
    console.error("Error al obtener participaciones:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const generarCertificadoParticipacion = async (req, res) => {
  try {
    const { id_participacion } = req.params;

    const participacion = await Participacion.findByPk(id_participacion, {
      include: [
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          include: [
            {
              model: Edicion,
              as: "edicion",
            },
            {
              model: Categoria,
              as: "categoria",
            },
          ],
        },
        {
          model: Usuario,
          as: "usuario",
        },
      ],
    });

    if (!participacion) {
      return res.status(404).json({
        message: "No se encontró la participación.",
      });
    }

    // Cada participante solo puede descargar el certificado de su propia participación
    if (participacion.id_usuario !== req.user.data.id_usuario) {
      return res.status(403).json({
        message: "No tienes permiso para descargar este certificado.",
      });
    }

    if (participacion.estado !== "evaluada") {
      return res.status(400).json({
        message:
          "El certificado estará disponible cuando finalice la evaluación.",
      });
    }

    if (participacion.calificacion_final === null) {
      return res.status(400).json({
        message: "La participación aún no tiene una calificación final.",
      });
    }

    const nombreParticipante =
      `${participacion.usuario?.primer_nombre || ""} ${participacion.usuario?.segundo_nombre || ""} ${participacion.usuario?.primer_apellido || ""} ${participacion.usuario?.segundo_apellido || ""}`.trim();

    const nombreEdicion =
      participacion.edicionCategoria?.edicion?.nombre_edicion;

    const nombreCategoria =
      participacion.edicionCategoria?.categoria?.nombre_categoria;

    const calificacion = Number(participacion.calificacion_final).toFixed(2);

    const esGanador = participacion.es_ganador === true;

    const puesto = participacion.puesto;

    const fecha = dayjs().format("DD/MM/YYYY");

    const pdf = await generarCertificado({
      nombreParticipante,
      nombreEdicion,
      nombreCategoria,
      calificacion,
      esGanador,
      puesto,
      fecha,
    });

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificado-participacion-${participacion.id_participacion}.pdf"`,
    );

    res.send(pdf);
  } catch (error) {
    console.error("Error al generar certificado:", error);

    res.status(500).json({
      message: "Error al generar el certificado.",
    });
  }
};

module.exports = {
  listarParticipantes,
  agregarParticipante,
  editarInformacionParticipante,
  cambiarEstadoParticipante,
  obtenerParticipante,
  obtenerEdicionesParticipacionParticipante,
  obtenerCategoriasEdicionesParticipacionParticipante,
  obtenerConvocatoriasParticipante,
  obtenerParticipaciones,
  obtenerEdicionesPorParticipante,
  obtenerParticipacionesPorParticipante,
  generarCertificadoParticipacion,
  obtenerParticipacionesPorJurado,
};

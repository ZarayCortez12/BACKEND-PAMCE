const jwt = require("jsonwebtoken");
const sequelize = require("../configs/db");
const path = require("path");
const {
  sendEmailAceptarPostulacion,
  sendEmailRechazarPostulacion,
} = require("../configs/mail.config");
const fs = require("fs");
const {
  Usuario,
  Participacion,
  Convocatoria,
  ParticipacionRequisito,
  Edicion,
  EdicionCategoria,
  Categoria,
  ParticipacionJurado,
  Rol,
  EvaluacionCriterio,
} = require("../models");
const { Op, fn, col, where } = require("sequelize");
const { Fn } = require("sequelize/lib/utils");
const { setAuditContext } = require("../utils/audits");
const NotificacionService = require("../middlewares/notificaciones.js");

const listarParticipacionesPorEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;
    const {
      search = "",
      genero,
      estado_jurado,
      categoria,
      page,
      limit,
    } = req.query;

    let juradoInclude = {
      model: ParticipacionJurado,
      as: "juradosAsignados",
      required: false,
      include: [
        {
          model: Usuario,
          as: "jurado",
        },
      ],
    };

    let whereJurado = {};

    if (estado_jurado === "true") {
      juradoInclude.required = true;
    }

    const queryOptions = {
      where: {
        id_edicion: id_edicion,
        estado: {
          [Op.in]: ["aceptada", "evaluada"],
        },
        ...(estado_jurado === "false" && {
          "$juradosAsignados.id_participacion$": null,
        }),
      },
      include: [
        {
          model: Usuario,
          as: "usuario",
          required: true,
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
            ...(genero && genero !== "TODOS" && { genero }),
          },
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          where: {
            ...(categoria &&
              categoria !== "TODOS" && { id_edicion_categoria: categoria }),
          },
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
          ],
        },
        juradoInclude,
      ],
      distinct: true,
      subQuery: false,
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
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarConvocatoriasPorEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;
    const { search = "", estado, page, limit } = req.query;

    const queryOptions = {
      where: {
        id_edicion,
        ...(estado &&
          estado !== "TODOS" && {
            estado_envio: estado,
          }),
        ...(search && {
          [Op.or]: [
            {
              correo_electronico: {
                [Op.iLike]: `%${search}%`,
              },
            },
          ],
        }),
      },
      distinct: true,
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Convocatoria.findAndCountAll(queryOptions);

    const resumen = await Convocatoria.findAll({
      where: {
        id_edicion,
      },
      attributes: ["fecha_envio", "fecha_respuesta", "estado_envio"],
    });

    return res.json({
      mensaje: "Convocatorias obtenidas correctamente",
      convocatorias: rows,
      resumen,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const listarParticipacionesGanadorasPorEdicionCategoria = async (req, res) => {
  try {
    const { id_edicion_categoria } = req.params;
    const { search = "", genero, categoria, page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows } = await Participacion.findAndCountAll({
      where: { id_edicion_categoria, puesto: { [Op.ne]: null } },
      include: [
        {
          model: Usuario,
          as: "usuario",
          required: true,
          where: {
            ...(search && {
              numero_documento: { [Op.iLike]: `%${search}%` },
            }),
            ...(genero && genero !== "TODOS" && { genero }),
          },
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          include: [
            {
              model: Categoria,
              as: "categoria",
              where: {
                ...(categoria && categoria !== "TODOS" && { categoria }),
              },
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    return res.json({
      mensaje: "Participaciones ganadoras obtenidas correctamente",
      participaciones_ganadoras: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error interno" });
  }
};

const listarPostulacionesPorCategoriaEdicion = async (req, res) => {
  try {
    const { id_edicion_categoria } = req.params;
    const { search = "", genero, estado, page, limit } = req.query;

    const queryOptions = {
      where: {
        id_edicion_categoria: id_edicion_categoria,
        ...(estado && estado !== "TODOS" && { estado }),
      },
      include: [
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
                { correo_electronico: { [Op.iLike]: `%${search}%` } },
              ],
            }),
            ...(genero && genero !== "TODOS" && { genero }),
          },
        },
      ],
      distinct: true,
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Participacion.findAndCountAll(queryOptions);

    return res.json({
      message: "Postulaciones obtenidas correctamente",
      postulaciones: rows,
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

const listarParticipacionesPorCategoriaEdicion = async (req, res) => {
  try {
    const { id_edicion_categoria } = req.params;
    const { search = "", genero, page, limit } = req.query;

    const queryOptions = {
      where: {
        id_edicion_categoria: id_edicion_categoria,
        estado: { [Op.in]: ["aceptada", "evaluada"] },
      },
      include: [
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
                { correo_electronico: { [Op.iLike]: `%${search}%` } },
              ],
            }),
            ...(genero && genero !== "TODOS" && { genero }),
          },
        },
      ],
      distinct: true,
      subQuery: false,
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
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarPostulacionesPorEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;
    const { search = "", genero, categoria, estado, page, limit } = req.query;

    const queryOptions = {
      where: {
        id_edicion: id_edicion,
        ...(estado && estado !== "TODOS" && { estado }),
      },
      include: [
        {
          model: Usuario,
          as: "usuario",
          required: true,
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
          },
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          where: {
            ...(categoria &&
              categoria !== "TODOS" && { id_edicion_categoria: categoria }),
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
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.order = [["id_participacion", "DESC"]];
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Participacion.findAndCountAll(queryOptions);

    return res.json({
      message: "Postulaciones obtenidas correctamente",
      postulaciones: rows,
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

const listarParticipacionesGanadorasPorEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;
    const { search = "", genero, categoria, page, limit } = req.query;

    const queryOptions = {
      where: { id_edicion, puesto: { [Op.ne]: null } },
      include: [
        {
          model: Usuario,
          as: "usuario",
          required: true,
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
          },
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          include: [
            {
              model: Categoria,
              as: "categoria",
              where: {
                ...(categoria &&
                  categoria !== "TODOS" && { id_edicion_categoria: categoria }),
              },
            },
          ],
        },
      ],
      distinct: true,
    };

    if (page && limit) {
      queryOptions.order = [["id_participacion", "DESC"]];
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Participacion.findAndCountAll(queryOptions);

    return res.json({
      mensaje: "Participaciones ganadoras obtenidas correctamente",
      participaciones_ganadoras: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error interno" });
  }
};

const editarRespuestaParticipacion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_participacion_requisito } = req.params;

    const respuesta = await ParticipacionRequisito.findByPk(
      id_participacion_requisito,
      { transaction },
    );

    if (!respuesta) {
      await transaction.rollback();
      return res.status(404).json({
        message: "La respuesta no existe.",
      });
    }

    let archivoAnterior = null;

    if (req.file) {
      if (respuesta.tipo_respuesta !== "documento") {
        await transaction.rollback();
        return res.status(400).json({
          message: "La respuesta seleccionada no corresponde a un documento.",
        });
      }

      archivoAnterior = respuesta.ruta_archivo;

      await respuesta.update(
        {
          ruta_archivo: path
            .relative(path.join(__dirname, ".."), req.file.path)
            .replace(/\\/g, "/"),
          nombre_archivo: req.file.originalname,
          extension_archivo: path.extname(req.file.originalname),
          tamano_bytes: req.file.size,
          fecha_envio: new Date(),
        },
        { transaction },
      );
    } else {
      if (respuesta.tipo_respuesta !== "texto") {
        await transaction.rollback();
        return res.status(400).json({
          message: "La respuesta seleccionada no corresponde a un texto.",
        });
      }

      const { valor_texto } = req.body;

      if (!valor_texto || valor_texto.trim() === "") {
        await transaction.rollback();
        return res.status(400).json({
          message: "La respuesta no puede estar vacía.",
        });
      }

      await respuesta.update(
        {
          valor_texto: valor_texto.trim(),
          fecha_envio: new Date(),
        },
        { transaction },
      );
    }

    await transaction.commit();

    // Si el archivo nuevo tiene otra extensión, el anterior queda con otro
    // nombre: se elimina para no dejar archivos huérfanos en el servidor
    if (archivoAnterior && archivoAnterior !== respuesta.ruta_archivo) {
      fs.unlink(path.join(__dirname, "..", archivoAnterior), (error) => {
        if (error && error.code !== "ENOENT") {
          console.error("No se pudo eliminar el archivo anterior:", error);
        }
      });
    }

    return res.status(200).json({
      message: "Respuesta actualizada correctamente.",
      respuesta,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({
      message: "Error al actualizar la respuesta.",
    });
  }
};

const listarPostulaciones = async (req, res) => {
  try {
    const { idEdicion } = req.params;

    const postulaciones = await Participacion.findAll({
      where: {
        id_edicion: idEdicion,
      },
      attributes: [
        "id_participacion",
        "estado",
        "fecha_postulacion",
        "fecha_revision",
        "observacion",
      ],
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: [
            "id_usuario",
            "tipo_documento",
            "numero_documento",
            "primer_nombre",
            "segundo_nombre",
            "primer_apellido",
            "segundo_apellido",
            "correo_electronico",
            "telefono",
            "direccion",
            "genero",
            "fecha_nacimiento",
            "codigo_institucional",
            "nivel_estudio_superior",
          ],
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          attributes: [
            "id_edicion_categoria",
            "descripcion",
            "numero_ganadores",
          ],
          include: [
            {
              model: Categoria,
              as: "categoria",
              attributes: ["id_categoria", "nombre_categoria"],
            },
          ],
        },
      ],
      order: [["fecha_postulacion", "DESC"]],
    });

    if (!postulaciones || postulaciones.length === 0) {
      return res.status(404).json({
        message: "No hay postulaciones registradas para esta edición",
      });
    }

    return res.json({
      message: "Postulaciones obtenidas correctamente",
      postulaciones,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerParticipacion = async (req, res) => {
  try {
    const { id_participacion } = req.params;

    const participacion = await Participacion.findByPk(id_participacion, {
      include: [
        {
          model: Usuario,
          as: "usuario",
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
            {
              model: Edicion,
              as: "edicion",
            },
          ],
        },
        {
          model: ParticipacionJurado,
          as: "juradosAsignados",
          include: [
            {
              model: Usuario,
              as: "jurado",
            },
          ],
        },
        {
          model: ParticipacionRequisito,
          as: "respuestas",
        },
      ],
      order: [["fecha_postulacion", "DESC"]],
    });

    if (!participacion) {
      return res.status(404).json({
        message: "No se encontró la participación",
      });
    }

    return res.json({
      message: "Información obtenida correctamente",
      participacion: participacion,
    });
  } catch (error) {
    console.error("Error al obtener participacion:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const obtenerParticipacionAEvaluar = async (req, res) => {
  try {
    const { id_participacion } = req.params;

    const id_usuario = req.user.data.id_usuario;

    if (!id_usuario) {
      return res.status(401).json({
        message: "No se pudo identificar al jurado autenticado",
      });
    }

    const edicionEnProceso = await Edicion.findOne({
      where: {
        estado_edicion: "en_proceso",
      },
    });

    if (!edicionEnProceso) {
      return res.status(404).json({
        message: "No existe una edición en proceso actualmente.",
      });
    }

    const participacion = await Participacion.findByPk(id_participacion, {
      include: [
        {
          model: Usuario,
          as: "usuario",
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
            {
              model: Edicion,
              as: "edicion",
            },
          ],
        },
        {
          model: ParticipacionJurado,
          as: "juradosAsignados",
          include: [
            {
              model: Usuario,
              as: "jurado",
            },
          ],
        },
        {
          model: ParticipacionRequisito,
          as: "respuestas",
        },
      ],
    });

    if (!participacion) {
      return res.status(404).json({
        message: "No se encontró la participación",
      });
    }

    if (
      Number(participacion.id_edicion) !== Number(edicionEnProceso.id_edicion)
    ) {
      return res.status(403).json({
        message:
          "No puedes evaluar participaciones que pertenecen a otra edición.",
      });
    }

    const estaAsignada = participacion.juradosAsignados?.some(
      (asignacion) =>
        Number(asignacion.jurado?.id_usuario) === Number(id_usuario),
    );

    if (!estaAsignada) {
      return res.status(403).json({
        message: "Participación no asignada",
      });
    }

    return res.status(200).json({
      message: "Información obtenida correctamente",
      participacion,
    });
  } catch (error) {
    console.error("Error al obtener participación para evaluar:", error);

    return res.status(500).json({
      message: "Error en el servidor",
    });
  }
};

const obtenerParticipacionParticipante = async (req, res) => {
  try {
    const { id_participacion } = req.params;
    const id_usuario = req.user.data.id_usuario;

    console.log(id_usuario, id_participacion);

    const participacion = await Participacion.findByPk(id_participacion, {
      include: [
        {
          model: Usuario,
          as: "usuario",
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
            {
              model: Edicion,
              as: "edicion",
            },
          ],
        },
        {
          model: ParticipacionJurado,
          as: "juradosAsignados",
          include: [
            {
              model: Usuario,
              as: "jurado",
            },
          ],
        },
        {
          model: ParticipacionRequisito,
          as: "respuestas",
        },
      ],
    });

    if (!participacion) {
      return res.status(404).json({
        message: "La participación no existe.",
      });
    }

    if (Number(participacion.id_usuario) !== Number(id_usuario)) {
      return res.status(403).json({
        message: "No tienes permiso para consultar esta participación.",
      });
    }

    return res.status(200).json({
      message: "Participación obtenida correctamente.",
      participacion,
    });
  } catch (error) {
    console.error("Error al obtener la participación:", error);

    return res.status(500).json({
      message: "Error al obtener la participación.",
    });
  }
};

const mostrarDocumento = async (req, res) => {
  try {
    const { id_participacion_requisito } = req.params;

    const documento = await ParticipacionRequisito.findByPk(
      id_participacion_requisito,
      {
        include: [
          {
            model: Participacion,
            as: "participacion",
            attributes: ["id_participacion", "id_usuario"],
          },
        ],
      },
    );

    if (!documento || documento.tipo_respuesta !== "documento") {
      return res.status(404).json({
        message: "Documento no encontrado",
      });
    }

    // Administrador y director ven todo; el participante solo lo suyo
    // y el jurado solo las participaciones que tiene asignadas
    const id_usuario = req.user.data.id_usuario;
    const rol = req.user.data.rol_activo.nombre_rol;

    let tieneAcceso = rol === "administrador" || rol === "director";

    if (rol === "participante") {
      tieneAcceso = documento.participacion?.id_usuario === id_usuario;
    }

    if (rol === "jurado") {
      const asignacion = await ParticipacionJurado.findOne({
        where: {
          id_participacion: documento.id_participacion,
          id_jurado: id_usuario,
        },
      });
      tieneAcceso = Boolean(asignacion);
    }

    if (!tieneAcceso) {
      return res.status(403).json({
        message: "No tienes permiso para ver este documento",
      });
    }

    // La ruta guardada debe quedar dentro de la carpeta de documentos
    const carpetaDocumentos = path.resolve(__dirname, "..", "documentos");
    const rutaAbsoluta = path.resolve(__dirname, "..", documento.ruta_archivo);

    if (!rutaAbsoluta.startsWith(carpetaDocumentos + path.sep)) {
      return res.status(404).json({
        message: "Documento no encontrado",
      });
    }

    if (!fs.existsSync(rutaAbsoluta)) {
      return res.status(404).json({
        message: "Archivo no existe en el servidor",
      });
    }

    // Solo PDF e imágenes se muestran en el navegador; lo demás se descarga,
    // así un archivo HTML subido nunca se ejecuta dentro del sitio
    const extension = path.extname(rutaAbsoluta).toLowerCase();
    const seMuestra = [".pdf", ".png", ".jpg", ".jpeg"].includes(extension);
    const nombre = encodeURIComponent(documento.nombre_archivo || "documento");

    res.setHeader(
      "Content-Disposition",
      `${seMuestra ? "inline" : "attachment"}; filename*=UTF-8''${nombre}`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");

    res.sendFile(rutaAbsoluta);
  } catch (error) {
    console.error("Error al mostrar documento:", error);
    res.status(500).json({
      message: "Error al obtener el documento",
    });
  }
};

const cambiarEstadoParticipacion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_participacion } = req.params;

    const { estado, observacion } = req.body;

    const participacionUpdate = await Participacion.findByPk(id_participacion, {
      transaction,
    });

    if (!participacionUpdate) {
      await transaction.rollback();
      return res.status(404).json({ message: "Participación no encontrada" });
    }

    participacionUpdate.estado = estado;
    if (observacion) participacionUpdate.observacion = observacion;
    participacionUpdate.fecha_revision = new Date();

    await participacionUpdate.save({ transaction });

    const participacion = await Participacion.findByPk(id_participacion, {
      include: [
        {
          model: Usuario,
          as: "usuario",
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
            {
              model: Edicion,
              as: "edicion",
            },
          ],
        },
        {
          model: ParticipacionJurado,
          as: "juradosAsignados",
          include: [
            {
              model: Usuario,
              as: "jurado",
            },
          ],
        },
        {
          model: ParticipacionRequisito,
          as: "respuestas",
        },
      ],
      transaction,
      order: [["fecha_postulacion", "DESC"]],
    });

    if (!participacion) {
      await transaction.rollback();
      return res.status(404).json({
        message: "No se encontró la participación",
      });
    }

    const edicion = await Edicion.findByPk(participacionUpdate.id_edicion, {
      transaction,
    });

    const usuario = await Usuario.findByPk(participacionUpdate.id_usuario, {
      transaction,
    });

    if (participacionUpdate.estado === "aceptada") {
      const notificacion = await NotificacionService.crear({
        tipo: "POSTULACION_ACEPTADA",
        titulo: "Postulación aceptada",
        mensaje: `
          <p>Hola <b>${usuario.primer_nombre}</b>,</p>

          <p>
            Nos complace informarte que tu postulación a la edición
            <b>${edicion.nombre_edicion}</b> ha sido
            <b>aceptada</b> después de la revisión de los requisitos establecidos.
          </p>

          <p>
            <b>Categoría:</b> ${participacion.edicionCategoria.categoria.nombre_categoria}
          </p>

          <p>
            Tu postulación continuará a la etapa de evaluación,
            en la cual será revisada de acuerdo con los criterios establecidos
            para la categoría.
          </p>

          <p>
            Te notificaremos por este medio y por correo electrónico
            cualquier actualización relacionada con el proceso.
          </p>

          <p>
            ¡Gracias por participar en el
            <b>Premio Anual al Mérito Científico y Empresarial (PAMCE)</b>!
          </p>
        `,
        prioridad: "media",
        id_usuario: usuario.id_usuario,
        id_rol: 4,
        datos: {
          id_edicion: edicion.id_edicion,
          nombre_edicion: edicion.nombre_edicion,
          id_edicion_categoria:
            participacion.edicionCategoria.id_edicion_categoria,
          nombre_categoria:
            participacion.edicionCategoria.categoria.nombre_categoria,
          estado_postulacion: "Aceptada",
        },
      });

      await NotificacionService.procesar(notificacion, ["sistema"], usuario);

      sendEmailAceptarPostulacion(
        usuario.correo_electronico,
        usuario.primer_nombre,
        edicion.nombre_edicion,
        participacion.edicionCategoria.categoria.nombre_categoria,
      );
    }

    if (participacionUpdate.estado === "rechazada") {
      const notificacion = await NotificacionService.crear({
        tipo: "POSTULACION_RECHAZADA",
        titulo: "Postulación rechazada",
        mensaje: `
          <p>Hola <b>${usuario.primer_nombre}</b>,</p>

          <p>
            Nos complace informarte que tu postulación a la edición
            <b>${edicion.nombre_edicion}</b> ha sido
            <b>rechazada</b> después de la revisión de los requisitos establecidos.
          </p>

          <p>
            <b>Categoría:</b> ${participacion.edicionCategoria.categoria.nombre_categoria}
          </p>

          <p>
            Tu postulación continuará a la etapa de evaluación,
            en la cual será revisada de acuerdo con los criterios establecidos
            para la categoría.
          </p>

          <p>
            Te notificaremos por este medio y por correo electrónico
            cualquier actualización relacionada con el proceso.
          </p>

          <p>
            ¡Gracias por participar en el
            <b>Premio Anual al Mérito Científico y Empresarial (PAMCE)</b>!
          </p>
        `,
        prioridad: "media",
        id_usuario: usuario.id_usuario,
        id_rol: 4,
        datos: {
          id_edicion: edicion.id_edicion,
          nombre_edicion: edicion.nombre_edicion,
          id_edicion_categoria:
            participacion.edicionCategoria.id_edicion_categoria,
          nombre_categoria:
            participacion.edicionCategoria.categoria.nombre_categoria,
          estado_postulacion: "Rechazada",
        },
      });

      await NotificacionService.procesar(notificacion, ["sistema"], usuario);

      sendEmailRechazarPostulacion(
        usuario.correo_electronico,
        usuario.primer_nombre,
        edicion.nombre_edicion,
        participacion.edicionCategoria.categoria.nombre_categoria,
      );
    }

    await transaction.commit();

    return res.status(200).json({
      message: "Estado de la participación actualizado correctamente",
      participacion: participacion,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error al cambiar estado de participación:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const actualizarComentarios = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_participacion } = req.params;

    const { comentarios } = req.body;

    const participacionUpdate = await Participacion.findByPk(id_participacion, {
      transaction,
    });

    if (!participacionUpdate) {
      await transaction.rollback();
      return res.status(404).json({ message: "Participación no encontrada" });
    }

    await Participacion.update(
      {
        comentarios,
      },
      {
        where: { id_participacion },
        transaction,
      },
    );

    const participacion = await Participacion.findByPk(id_participacion, {
      include: [
        {
          model: Usuario,
          as: "usuario",
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
            {
              model: Edicion,
              as: "edicion",
            },
          ],
        },
        {
          model: ParticipacionJurado,
          as: "juradosAsignados",
          include: [
            {
              model: Usuario,
              as: "jurado",
            },
          ],
        },
        {
          model: ParticipacionRequisito,
          as: "respuestas",
        },
      ],
      transaction,
      order: [["fecha_postulacion", "DESC"]],
    });

    if (!participacion) {
      await transaction.rollback();
      return res.status(404).json({
        message: "No se encontró la participación",
      });
    }

    await transaction.commit();

    return res.status(200).json({
      message: "Comentarios actualizados correctamente",
      participacion: participacion,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error al actualizar comentarios:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const agregarJuradoAParticipacion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_participacion } = req.params;
    const { id_jurado } = req.body;

    const jurado = await Usuario.findByPk(id_jurado, {
      include: [
        {
          model: Rol,
          as: "roles",
        },
      ],
      transaction,
    });

    const participacion = await Participacion.findByPk(id_participacion, {
      include: [
        {
          model: Usuario,
          as: "usuario",
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
            {
              model: Edicion,
              as: "edicion",
            },
          ],
        },
      ],
      transaction,
    });

    if (!participacion) {
      await transaction.rollback();

      return res.status(404).json({
        message: "La participación no fue encontrada",
      });
    }

    const asignado = await ParticipacionJurado.create(
      {
        id_participacion,
        id_jurado,
        estado: "asignado",
        fecha_asignacion: new Date(),
      },
      { transaction },
    );

    const jurado_asignado = await ParticipacionJurado.findByPk(
      asignado.id_participacion_jurado,
      {
        include: [
          {
            model: Usuario,
            as: "jurado",
          },
        ],
        transaction,
      },
    );

    const usuario = participacion.usuario;
    const edicion = participacion.edicionCategoria.edicion;
    const categoria = participacion.edicionCategoria.categoria;

    await transaction.commit();

    const notificacionJurado = await NotificacionService.crear({
      tipo: "PARTICIPACION_ASIGNADA",
      titulo: "Nueva participación asignada",
      mensaje: `
        <p>Hola <b>${jurado.primer_nombre}</b>,</p>

        <p>
          Se te ha asignado una nueva participación para realizar
          el proceso de evaluación en la
          <b>${edicion.nombre_edicion}</b>.
        </p>

        <p>
          <b>Categoría:</b> ${categoria.nombre_categoria}
        </p>

        <p>
          Ya puedes consultar la información de la participación
          y realizar la evaluación de acuerdo con los criterios
          establecidos para esta categoría.
        </p>

        <p>
          Recuerda realizar la evaluación de manera objetiva,
          imparcial y conforme a las rúbricas definidas para el proceso.
        </p>
      `,
      prioridad: "media",
      id_usuario: jurado.id_usuario,
      id_rol: 3,
      datos: {
        id_participacion: participacion.id_participacion,
        id_participacion_jurado: asignado.id_participacion_jurado,
        id_edicion: edicion.id_edicion,
        nombre_edicion: edicion.nombre_edicion,
        id_categoria: categoria.id_categoria,
        nombre_categoria: categoria.nombre_categoria,
        estado_asignacion: "asignado",
      },
    });

    await NotificacionService.procesar(notificacionJurado, ["sistema"], jurado);

    const notificacionParticipante = await NotificacionService.crear({
      tipo: "JURADO_ASIGNADO",
      titulo: "Jurado asignado a tu postulación",
      mensaje: `
        <p>Hola <b>${usuario.primer_nombre}</b>,</p>

        <p>
          Te informamos que ha sido asignado un jurado para la evaluación
          de tu postulación en la edición
          <b>${edicion.nombre_edicion}</b>.
        </p>

        <p>
          <b>Categoría:</b> ${categoria.nombre_categoria}
        </p>

        <p>
          Tu postulación continuará con el proceso de evaluación
          de acuerdo con los criterios y rúbricas establecidos
          para esta categoría.
        </p>

        <p>
          Te notificaremos cualquier actualización relacionada
          con el estado de tu postulación.
        </p>

        <p>¡Gracias por participar en el <b>Premio Anual al Mérito Científico y Empresarial (PAMCE)</b>!</p>
      
      `,
      prioridad: "media",
      id_usuario: usuario.id_usuario,
      id_rol: 4,
      datos: {
        id_participacion: participacion.id_participacion,
        id_edicion: edicion.id_edicion,
        nombre_edicion: edicion.nombre_edicion,
        id_categoria: categoria.id_categoria,
        nombre_categoria: categoria.nombre_categoria,
        estado_postulacion: participacion.estado,
      },
    });

    await NotificacionService.procesar(
      notificacionParticipante,
      ["sistema"],
      usuario,
    );

    return res.status(200).json({
      message: "Jurado asignado correctamente",
      jurado: jurado_asignado,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const cambiarEstadoAsignacionJurado = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_participacion_jurado } = req.params;
    const { estado } = req.body;

    const existe = await EvaluacionCriterio.findAll({
      where: {
        id_participacion_jurado: id_participacion_jurado,
      },
      transaction,
    });

    if (existe.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "No se puede cambiar el estado. La evaluación ya fue realizada",
      });
    }

    await ParticipacionJurado.update(
      {
        estado: estado,
      },
      {
        where: {
          id_participacion_jurado: id_participacion_jurado,
        },
        transaction,
      },
      { returning: true },
    );

    const asignacion = await ParticipacionJurado.findByPk(
      id_participacion_jurado,
      {
        include: [
          {
            model: Usuario,
            as: "jurado",
          },
          {
            model: Participacion,
            as: "participacion",
            include: [
              {
                model: Usuario,
                as: "usuario",
              },
              {
                model: EdicionCategoria,
                as: "edicionCategoria",
                include: [
                  {
                    model: Categoria,
                    as: "categoria",
                  },
                  {
                    model: Edicion,
                    as: "edicion",
                  },
                ],
              },
            ],
          },
        ],
        transaction,
      },
    );
    if (estado === "asignado" || estado === "retirado") {
      const esAsignado = estado === "asignado";

      const notificacion = await NotificacionService.crear({
        tipo: esAsignado ? "JURADO_REASIGNADO" : "JURADO_RETIRADO",
        titulo: esAsignado
          ? "Has sido asignado para evaluar una participación"
          : "Has sido retirado de una evaluación",
        mensaje: esAsignado
          ? `
        <p>Hola <b>${asignacion.jurado.primer_nombre}</b>,</p>

        <p>Has sido <b>reasignado</b> para evaluar la participación de
        <b>${asignacion.participacion.usuario.primer_nombre} ${asignacion.participacion.usuario.primer_apellido}</b>
        en la categoría <b>${asignacion.participacion.edicionCategoria.categoria.nombre_categoria}</b> de la edición
        <b>${asignacion.participacion.edicionCategoria.edicion.nombre_edicion}</b>.</p>

        <p>Cuando la etapa de evaluación se encuentre habilitada, podrás ingresar a la plataforma para realizar la evaluación correspondiente.</p>

        <p>Gracias por formar parte del equipo de jurados del <b>Premio Anual al Mérito Científico y Empresarial (PAMCE)</b>.</p>
      `
          : `
        <p>Hola <b>${asignacion.jurado.primer_nombre}</b>,</p>

        <p>Te informamos que has sido <b>retirado</b> de la evaluación de la participación de
        <b>${asignacion.participacion.usuario.primer_nombre} ${asignacion.participacion.usuario.primer_apellido}</b>
        en la categoría <b>${asignacion.participacion.edicionCategoria.categoria.nombre_categoria}</b> de la edición
        <b>${asignacion.participacion.edicionCategoria.edicion.nombre_edicion}</b>.</p>

        <p>Esta participación ya no se encuentra asignada a tu panel de evaluación.</p>

        <p>Gracias por tu disposición y apoyo al <b>Premio Anual al Mérito Científico y Empresarial (PAMCE)</b>.</p>
      `,
        prioridad: "media",
        id_usuario: asignacion.jurado.id_usuario,
        id_rol: 2,
        datos: {
          id_edicion:
            asignacion.participacion.edicionCategoria.edicion.id_edicion,
          nombre_edicion:
            asignacion.participacion.edicionCategoria.edicion.nombre_edicion,
          id_categoria:
            asignacion.participacion.edicionCategoria.categoria.id_categoria,
          nombre_categoria:
            asignacion.participacion.edicionCategoria.categoria
              .nombre_categoria,
          id_participacion: asignacion.participacion.id_participacion,
          participante: `${asignacion.participacion.usuario.primer_nombre} ${asignacion.participacion.usuario.primer_apellido}`,
          estado_jurado: esAsignado ? "Asignado" : "Retirado",
        },
      });

      await NotificacionService.procesar(
        notificacion,
        ["sistema"],
        asignacion.jurado.id_usuario,
      );
    }

    const jurado = await ParticipacionJurado.findByPk(id_participacion_jurado, {
      include: [
        {
          model: Usuario,
          as: "jurado",
        },
      ],
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      message: "Estado de la asignación de jurado actualizado correctamente",
      jurado: jurado,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarJuradosParticipacion = async (req, res) => {
  try {
    const { id_participacion } = req.params;
    const { search = "", genero, estado, page, limit } = req.query;

    const queryOptions = {
      where: {
        id_participacion: id_participacion,
        ...(estado && estado !== "TODOS" && { estado }),
      },
      include: [
        {
          model: Usuario,
          as: "jurado",
          required: true,
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
            ...(genero && genero !== "TODOS" && { genero }),
          },
        },
      ],
      distinct: true,
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } =
      await ParticipacionJurado.findAndCountAll(queryOptions);

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

module.exports = {
  listarParticipacionesPorEdicion,
  listarConvocatoriasPorEdicion,
  listarParticipacionesGanadorasPorEdicionCategoria,
  listarPostulacionesPorCategoriaEdicion,
  listarParticipacionesPorCategoriaEdicion,
  listarPostulacionesPorEdicion,
  listarParticipacionesGanadorasPorEdicion,
  listarJuradosParticipacion,
  editarRespuestaParticipacion,
  listarPostulaciones,
  obtenerParticipacion,
  obtenerParticipacionAEvaluar,
  obtenerParticipacionParticipante,
  mostrarDocumento,
  cambiarEstadoParticipacion,
  actualizarComentarios,
  agregarJuradoAParticipacion,
  cambiarEstadoAsignacionJurado,
};

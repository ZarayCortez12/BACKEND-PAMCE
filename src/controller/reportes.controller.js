const sequelize = require("../configs/db");
const path = require("path");
const fs = require("fs");
const {
  Usuario,
  Rol,
  Participacion,
  Convocatoria,
  Edicion,
  EdicionCategoria,
  Categoria,
  ParticipacionJurado,
} = require("../models");
const { Op, col, where } = require("sequelize");
const dayjs = require("dayjs");
const { generarPDF } = require("../middlewares/pdfGenerate");
const { generarExcel } = require("../middlewares/excelGenerate");

const reportesParticipaciones = async (req, res) => {
  try {
    const {
      edicion,
      categoria,
      participante,
      genero,
      nivel_estudio_superior,
      fecha_inicio,
      fecha_fin,
      page = 1,
      limit = 10,
      cantidad,
      ordenar_por,
      direccion,
    } = req.query;

    const pagina = Math.max(1, parseInt(page, 10) || 1);
    const limitePagina = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pagina - 1) * limitePagina;

    const cantidadSolicitada =
      cantidad !== undefined && cantidad !== "" ? parseInt(cantidad, 10) : null;

    const cantidadReporte =
      cantidadSolicitada !== null &&
      Number.isInteger(cantidadSolicitada) &&
      cantidadSolicitada > 0
        ? cantidadSolicitada
        : null;

    const whereParticipacion = {
      estado: {
        [Op.in]: ["aceptada", "evaluada"],
      },
      ...(edicion && { id_edicion: edicion }),
      ...(categoria && { id_edicion_categoria: categoria }),
    };

    if (fecha_inicio || fecha_fin) {
      whereParticipacion.fecha_revision = {};

      if (fecha_inicio) {
        whereParticipacion.fecha_revision[Op.gte] = dayjs(fecha_inicio)
          .startOf("day")
          .toDate();
      }

      if (fecha_fin) {
        whereParticipacion.fecha_revision[Op.lte] = dayjs(fecha_fin)
          .endOf("day")
          .toDate();
      }
    }

    const includeUsuario = {
      model: Usuario,
      as: "usuario",
      required: true,
      where: {
        ...(participante && { id_usuario: participante }),
        ...(genero && { genero }),
        ...(nivel_estudio_superior && { nivel_estudio_superior }),
      },
    };

    const includeEdicionCategoria = {
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
    };

    const includeEdicion = {
      model: Edicion,
      as: "edicion",
    };

    const totalFiltrado = await Participacion.count({
      where: whereParticipacion,
      include: [includeUsuario],
      distinct: true,
      col: "id_participacion",
    });

    const total =
      cantidadReporte !== null
        ? Math.min(totalFiltrado, cantidadReporte)
        : totalFiltrado;

    const limiteConsulta = Math.max(0, Math.min(limitePagina, total - offset));

    const camposOrdenamiento = {
      fecha_revision: "fecha_revision",
      calificacion_final: "calificacion_final",
    };

    const campoOrden = camposOrdenamiento[ordenar_por];

    const order = campoOrden
      ? [
          [
            campoOrden,
            String(direccion).toUpperCase() === "ASC" ? "ASC" : "DESC",
          ],
        ]
      : [];

    let rows = [];

    if (limiteConsulta > 0) {
      rows = await Participacion.findAll({
        where: whereParticipacion,
        include: [includeUsuario, includeEdicionCategoria, includeEdicion],
        ...(order.length > 0 && { order }),
        limit: limiteConsulta,
        offset,
        distinct: true,
      });
    }

    return res.json({
      message: "Participaciones obtenidas correctamente",
      participaciones: rows,
      pagination: {
        total,
        page: pagina,
        totalPages: Math.ceil(total / limitePagina),
        limit: limitePagina,
      },
    });
  } catch (error) {
    console.error("Error al obtener el reporte de participaciones:", error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const obtenerParticipacionesReporte = async (req) => {
  const {
    edicion,
    categoria,
    participante,
    genero,
    nivel_estudio_superior,
    fecha_inicio,
    fecha_fin,
    cantidad,
    ordenar_por,
    direccion,
  } = req.query;

  const cantidadSolicitada =
    cantidad !== undefined && cantidad.trim?.() !== ""
      ? Number(cantidad)
      : null;

  const cantidadReporte =
    cantidadSolicitada !== null &&
    Number.isSafeInteger(cantidadSolicitada) &&
    cantidadSolicitada > 0
      ? cantidadSolicitada
      : null;

  const whereParticipacion = {
    estado: {
      [Op.in]: ["aceptada", "evaluada"],
    },

    ...(edicion && {
      id_edicion: edicion,
    }),

    ...(categoria && {
      id_edicion_categoria: categoria,
    }),
  };

  if (fecha_inicio || fecha_fin) {
    whereParticipacion.fecha_postulacion = {};

    if (fecha_inicio) {
      whereParticipacion.fecha_postulacion[Op.gte] = dayjs(fecha_inicio)
        .startOf("day")
        .toDate();
    }

    if (fecha_fin) {
      whereParticipacion.fecha_postulacion[Op.lte] = dayjs(fecha_fin)
        .endOf("day")
        .toDate();
    }
  }

  const camposOrdenamiento = {
    fecha_revision: "fecha_revision",
    calificacion_final: "calificacion_final",
  };

  const campoOrden = camposOrdenamiento[ordenar_por];

  const sentidoOrden = ["ASC", "DESC"].includes(String(direccion).toUpperCase())
    ? String(direccion).toUpperCase()
    : null;

  const order = campoOrden && sentidoOrden ? [[campoOrden, sentidoOrden]] : [];

  const participaciones = await Participacion.findAll({
    where: whereParticipacion,

    include: [
      {
        model: Usuario,
        as: "usuario",
        required: true,
        where: {
          ...(participante &&
            participante !== "TODOS" && {
              id_usuario: participante,
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
        model: Edicion,
        as: "edicion",
      },
    ],

    ...(order.length > 0 && { order }),

    ...(cantidadReporte !== null && {
      limit: cantidadReporte,
    }),

    distinct: true,
  });

  return participaciones;
};

const reportesPostulaciones = async (req, res) => {
  try {
    const {
      estado,
      edicion,
      categoria,
      participante,
      genero,
      nivel_estudio_superior,
      fecha_inicio,
      fecha_fin,
      cantidad,
      ordenar_por,
      direccion,
      page = 1,
      limit = 10,
    } = req.query;

    const pagina = Math.max(parseInt(page, 10) || 1, 1);
    const limite = Math.max(parseInt(limit, 10) || 10, 1);
    const offset = (pagina - 1) * limite;

    const whereParticipacion = {
      ...(estado && { estado }),
      ...(edicion && { id_edicion: edicion }),
      ...(categoria && { id_edicion_categoria: categoria }),
    };

    if (fecha_inicio || fecha_fin) {
      whereParticipacion.fecha_postulacion = {};

      if (fecha_inicio) {
        whereParticipacion.fecha_postulacion[Op.gte] = dayjs(fecha_inicio)
          .startOf("day")
          .toDate();
      }

      if (fecha_fin) {
        whereParticipacion.fecha_postulacion[Op.lte] = dayjs(fecha_fin)
          .endOf("day")
          .toDate();
      }
    }

    const whereUsuario = {
      ...(participante && { id_usuario: participante }),
      ...(genero && { genero }),
      ...(nivel_estudio_superior && {
        nivel_estudio_superior,
      }),
    };

    const camposOrdenamiento = {
      fecha_postulacion: "fecha_postulacion",
      estado: "estado",
    };

    const campoOrdenamiento = camposOrdenamiento[ordenar_por];

    const direccionNormalizada = String(direccion || "").toUpperCase();

    const direccionOrdenamiento = ["ASC", "DESC"].includes(direccionNormalizada)
      ? direccionNormalizada
      : null;

    const order =
      campoOrdenamiento && direccionOrdenamiento
        ? [[campoOrdenamiento, direccionOrdenamiento]]
        : [["fecha_postulacion", "DESC"]];

    const cantidadSolicitada = Number(cantidad);

    const cantidadValida =
      cantidad !== undefined &&
      cantidad !== null &&
      String(cantidad).trim() !== "" &&
      Number.isInteger(cantidadSolicitada) &&
      cantidadSolicitada > 0;

    const opcionesConsulta = {
      where: whereParticipacion,
      include: [
        {
          model: Usuario,
          as: "usuario",
          required: true,
          where: whereUsuario,
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
      distinct: true,
    };

    const countTotal = await Participacion.count({
      ...opcionesConsulta,
      col: "id_participacion",
    });

    const totalRegistros = cantidadValida
      ? Math.min(countTotal, cantidadSolicitada)
      : countTotal;

    const registrosRestantes = Math.max(totalRegistros - offset, 0);
    const limitePagina = Math.min(limite, registrosRestantes);

    const postulaciones =
      limitePagina > 0
        ? await Participacion.findAll({
            ...opcionesConsulta,
            order,
            limit: limitePagina,
            offset,
          })
        : [];

    return res.json({
      message: "Postulaciones obtenidas correctamente",
      postulaciones,
      pagination: {
        total: totalRegistros,
        page: pagina,
        totalPages: Math.ceil(totalRegistros / limite),
        limit: limite,
      },
    });
  } catch (error) {
    console.error("Error al obtener postulaciones:", error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const obtenerPostulacionesReporte = async (req) => {
  const {
    estado,
    edicion,
    categoria,
    participante,
    genero,
    nivel_estudio_superior,
    fecha_inicio,
    fecha_fin,
    cantidad,
    ordenar_por,
    direccion,
  } = req.query;

  const whereParticipacion = {
    ...(estado && { estado }),
    ...(edicion && { id_edicion: edicion }),
    ...(categoria && { id_edicion_categoria: categoria }),
  };

  if (fecha_inicio || fecha_fin) {
    const filtroFecha = {};

    if (fecha_inicio && dayjs(fecha_inicio).isValid()) {
      filtroFecha[Op.gte] = dayjs(fecha_inicio).startOf("day").toDate();
    }

    if (fecha_fin && dayjs(fecha_fin).isValid()) {
      filtroFecha[Op.lte] = dayjs(fecha_fin).endOf("day").toDate();
    }

    if (Object.keys(filtroFecha).length > 0) {
      whereParticipacion.fecha_postulacion = filtroFecha;
    }
  }

  const whereUsuario = {
    ...(participante && { id_usuario: participante }),
    ...(genero && { genero }),
    ...(nivel_estudio_superior && {
      nivel_estudio_superior,
    }),
  };

  const camposOrdenamiento = {
    fecha_postulacion: "fecha_postulacion",
    estado: "estado",
  };

  const campoOrdenamiento = camposOrdenamiento[ordenar_por];
  const direccionNormalizada = String(direccion || "").toUpperCase();

  const direccionOrdenamiento = ["ASC", "DESC"].includes(direccionNormalizada)
    ? direccionNormalizada
    : null;

  const order =
    campoOrdenamiento && direccionOrdenamiento
      ? [[campoOrdenamiento, direccionOrdenamiento]]
      : [["fecha_postulacion", "DESC"]];

  const cantidadSolicitada = Number(cantidad);

  const cantidadValida =
    cantidad !== undefined &&
    cantidad !== null &&
    String(cantidad).trim() !== "" &&
    Number.isInteger(cantidadSolicitada) &&
    cantidadSolicitada > 0;

  const postulaciones = await Participacion.findAll({
    where: whereParticipacion,
    include: [
      {
        model: Usuario,
        as: "usuario",
        required: true,
        where: whereUsuario,
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
    order,
    ...(cantidadValida && {
      limit: cantidadSolicitada,
    }),
  });

  const [edicionData, categoriaData, participanteData] = await Promise.all([
    edicion ? Edicion.findByPk(edicion) : null,
    categoria ? Categoria.findByPk(categoria) : null,
    participante ? Usuario.findByPk(participante) : null,
  ]);

  const nombreParticipante = participanteData
    ? [
        participanteData.primer_nombre,
        participanteData.segundo_nombre,
        participanteData.primer_apellido,
        participanteData.segundo_apellido,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  const filtrosReporte = {
    ...(edicionData && {
      edicion: edicionData.nombre_edicion,
    }),
    ...(categoriaData && {
      categoria: categoriaData.nombre_categoria,
    }),
    ...(nombreParticipante && {
      participante: nombreParticipante,
    }),
    ...(estado && { estado }),
    ...(genero && { género: genero }),
    ...(nivel_estudio_superior && {
      nivel_estudio_superior,
    }),
    ...(fecha_inicio && {
      fecha_inicio_postulaciones: fecha_inicio,
    }),
    ...(fecha_fin && {
      fecha_fin_postulaciones: fecha_fin,
    }),
    ...(cantidadValida && {
      cantidad_maxima: cantidadSolicitada,
    }),
    ...(campoOrdenamiento &&
      direccionOrdenamiento && {
        ordenar_por: campoOrdenamiento,
        direccion: direccionOrdenamiento,
      }),
  };

  return {
    postulaciones,
    filtrosReporte,
  };
};

const reportesConvocatorias = async (req, res) => {
  try {
    const {
      edicion,
      estado,
      participante,
      numeros_envios,
      fecha_inicio,
      fecha_fin,
      cantidad,
      ordenar_por,
      direccion,
      page = 1,
      limit = 10,
    } = req.query;

    const pagina = Math.max(parseInt(page, 10) || 1, 1);
    const limite = Math.max(parseInt(limit, 10) || 10, 1);
    const offset = (pagina - 1) * limite;

    const whereConvocatoria = {
      ...(edicion && { id_edicion: edicion }),
      ...(estado && { estado_envio: estado }),
      ...(numeros_envios !== undefined &&
        numeros_envios !== "" && {
          intentos_envio: numeros_envios,
        }),
      ...(participante && {
        correo_electronico: participante,
      }),
    };

    if (fecha_inicio || fecha_fin) {
      whereConvocatoria.fecha_envio = {};

      if (fecha_inicio) {
        whereConvocatoria.fecha_envio[Op.gte] = dayjs(fecha_inicio)
          .startOf("day")
          .toDate();
      }

      if (fecha_fin) {
        whereConvocatoria.fecha_envio[Op.lte] = dayjs(fecha_fin)
          .endOf("day")
          .toDate();
      }
    }

    const cantidadSolicitada = Number(cantidad);

    const cantidadValida =
      cantidad !== undefined &&
      cantidad !== null &&
      String(cantidad).trim() !== "" &&
      Number.isInteger(cantidadSolicitada) &&
      cantidadSolicitada > 0;

    const camposOrdenamiento = {
      fecha_envio: "fecha_envio",
      intentos_envio: "intentos_envio",
    };

    const campoOrdenamiento = camposOrdenamiento[ordenar_por];

    const direccionNormalizada = String(direccion || "").toUpperCase();

    const direccionOrdenamiento = ["ASC", "DESC"].includes(direccionNormalizada)
      ? direccionNormalizada
      : null;

    const order =
      campoOrdenamiento && direccionOrdenamiento
        ? [[campoOrdenamiento, direccionOrdenamiento]]
        : [["fecha_envio", "DESC"]];

    const opcionesConsulta = {
      where: whereConvocatoria,
      include: [
        {
          model: Edicion,
          as: "edicion",
          required: true,
        },
      ],
      distinct: true,
    };

    const countTotal = await Convocatoria.count(opcionesConsulta);

    const totalRegistros = cantidadValida
      ? Math.min(countTotal, cantidadSolicitada)
      : countTotal;

    const registrosRestantes = Math.max(totalRegistros - offset, 0);
    const limitePagina = Math.min(limite, registrosRestantes);

    const convocatorias =
      limitePagina > 0
        ? await Convocatoria.findAll({
            ...opcionesConsulta,
            order,
            limit: limitePagina,
            offset,
          })
        : [];

    return res.json({
      message: "Convocatorias obtenidas correctamente",
      convocatorias,
      pagination: {
        total: totalRegistros,
        page: pagina,
        totalPages: Math.ceil(totalRegistros / limite),
        limit: limite,
      },
    });
  } catch (error) {
    console.error("Error al obtener convocatorias:", error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const obtenerConvocatoriasReporte = async (query) => {
  const {
    edicion,
    estado,
    participante,
    numeros_envios,
    fecha_inicio,
    fecha_fin,
    cantidad,
    ordenar_por,
    direccion,
  } = query;

  const whereConvocatoria = {
    ...(edicion && { id_edicion: edicion }),
    ...(estado && { estado_envio: estado }),
    ...(numeros_envios !== undefined &&
      numeros_envios !== null &&
      String(numeros_envios).trim() !== "" && {
        intentos_envio: numeros_envios,
      }),
    ...(participante && {
      correo_electronico: participante,
    }),
  };

  if (fecha_inicio || fecha_fin) {
    whereConvocatoria.fecha_envio = {};

    if (fecha_inicio) {
      const inicio = dayjs(fecha_inicio);

      if (!inicio.isValid()) {
        throw new Error("La fecha de inicio no es válida");
      }

      whereConvocatoria.fecha_envio[Op.gte] = inicio.startOf("day").toDate();
    }

    if (fecha_fin) {
      const fin = dayjs(fecha_fin);

      if (!fin.isValid()) {
        throw new Error("La fecha de fin no es válida");
      }

      whereConvocatoria.fecha_envio[Op.lte] = fin.endOf("day").toDate();
    }
  }

  const cantidadSolicitada = Number(cantidad);

  const cantidadValida =
    cantidad !== undefined &&
    cantidad !== null &&
    String(cantidad).trim() !== "" &&
    Number.isInteger(cantidadSolicitada) &&
    cantidadSolicitada > 0;

  const camposOrdenamiento = {
    fecha_envio: "fecha_envio",
    intentos_envio: "intentos_envio",
  };

  const campoOrdenamiento = camposOrdenamiento[ordenar_por];

  const direccionNormalizada = String(direccion || "").toUpperCase();

  const direccionOrdenamiento = ["ASC", "DESC"].includes(direccionNormalizada)
    ? direccionNormalizada
    : null;

  const order =
    campoOrdenamiento && direccionOrdenamiento
      ? [[campoOrdenamiento, direccionOrdenamiento]]
      : [["fecha_envio", "DESC"]];

  const opcionesConsulta = {
    where: whereConvocatoria,
    include: [
      {
        model: Edicion,
        as: "edicion",
        required: true,
      },
    ],
    order,
  };

  const convocatorias = await Convocatoria.findAll({
    ...opcionesConsulta,
    ...(cantidadValida && {
      limit: cantidadSolicitada,
    }),
  });

  const edicionData = edicion ? await Edicion.findByPk(edicion) : null;

  const filtrosReporte = {
    ...(edicionData && {
      edicion: edicionData.nombre_edicion,
    }),
    ...(participante && {
      participante,
    }),
    ...(estado && {
      estado_envio: estado,
    }),
    ...(numeros_envios !== undefined &&
      numeros_envios !== null &&
      String(numeros_envios).trim() !== "" && {
        numero_de_envios: numeros_envios,
      }),
    ...(fecha_inicio && {
      fecha_inicio_postulaciones: fecha_inicio,
    }),
    ...(fecha_fin && {
      fecha_fin_postulaciones: fecha_fin,
    }),
    ...(cantidadValida && {
      cantidad_maxima: cantidadSolicitada,
    }),
    ...(campoOrdenamiento &&
      direccionOrdenamiento && {
        ordenar_por: campoOrdenamiento,
        direccion: direccionOrdenamiento,
      }),
  };

  return {
    convocatorias,
    filtrosReporte,
  };
};

const reportesUsuarios = async (req, res) => {
  try {
    const {
      tipo,
      edicion,
      categoria,
      genero,
      nivel_estudio_superior,
      cantidad,
      ordenar_por,
      direccion,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 10, 1);
    const offset = (pageNumber - 1) * limitNumber;

    const whereUsuario = {
      ...(genero && { genero }),
      ...(nivel_estudio_superior && {
        nivel_estudio_superior,
      }),
    };

    const filtrarPorRelacion = Boolean(edicion || categoria);

    const camposOrdenamiento = {
      numero_documento: "numero_documento",
      primer_nombre: "primer_nombre",
      primer_apellido: "primer_apellido",
      correo_electronico: "correo_electronico",
      codigo_institucional: "codigo_institucional",
      nivel_estudio_superior: "nivel_estudio_superior",
    };

    const campoOrdenamiento =
      camposOrdenamiento[ordenar_por] || "primer_apellido";

    const direccionNormalizada = String(direccion || "ASC").toUpperCase();

    const direccionOrdenamiento = ["ASC", "DESC"].includes(direccionNormalizada)
      ? direccionNormalizada
      : "ASC";

    const order = [
      [campoOrdenamiento, direccionOrdenamiento],
      ["id_usuario", "ASC"],
    ];

    const cantidadSolicitada = Number(cantidad);

    const cantidadValida =
      cantidad !== undefined &&
      cantidad !== null &&
      String(cantidad).trim() !== "" &&
      Number.isInteger(cantidadSolicitada) &&
      cantidadSolicitada > 0;

    const include = [
      {
        model: Rol,
        as: "roles",
        required: true,
        ...(tipo && {
          where: {
            id_rol: tipo,
          },
        }),
      },
    ];

    if (tipo === "3") {
      include.push({
        model: ParticipacionJurado,
        as: "evaluacionesAsignadas",
        required: filtrarPorRelacion,
        include: [
          {
            model: Participacion,
            as: "participacion",
            required: filtrarPorRelacion,
            where: {
              ...(edicion && {
                id_edicion: edicion,
              }),
              ...(categoria && {
                id_edicion_categoria: categoria,
              }),
            },
          },
        ],
      });
    }

    if (tipo === "4") {
      include.push({
        model: Participacion,
        as: "participaciones",
        required: filtrarPorRelacion,
        where: {
          ...(edicion && {
            id_edicion: edicion,
          }),
          ...(categoria && {
            id_edicion_categoria: categoria,
          }),
        },
      });
    }

    const usuariosEncontrados = await Usuario.findAll({
      attributes: ["id_usuario"],
      where: whereUsuario,
      include,
      order,
      distinct: true,
      subQuery: false,
    });

    const idsUsuarios = [
      ...new Set(usuariosEncontrados.map((usuario) => usuario.id_usuario)),
    ];

    const totalEncontrado = idsUsuarios.length;

    const total = cantidadValida
      ? Math.min(totalEncontrado, cantidadSolicitada)
      : totalEncontrado;

    const idsLimitados = idsUsuarios.slice(0, total);

    const idsPagina = idsLimitados.slice(offset, offset + limitNumber);

    if (idsPagina.length === 0) {
      return res.json({
        message: "Usuarios obtenidos correctamente",
        usuarios: [],
        pagination: {
          total,
          page: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          limit: limitNumber,
        },
      });
    }

    const usuarios = await Usuario.findAll({
      where: {
        ...whereUsuario,
        id_usuario: idsPagina,
      },
      include,
      distinct: true,
      subQuery: false,
    });

    const posicionPorId = new Map(
      idsPagina.map((id, index) => [String(id), index]),
    );

    usuarios.sort(
      (a, b) =>
        posicionPorId.get(String(a.id_usuario)) -
        posicionPorId.get(String(b.id_usuario)),
    );

    return res.json({
      message: "Usuarios obtenidos correctamente",
      usuarios,
      pagination: {
        total,
        page: pageNumber,
        totalPages: Math.ceil(total / limitNumber),
        limit: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error al generar el reporte de usuarios:", error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const obtenerUsuariosParaReporte = async (query) => {
  const {
    tipo,
    edicion,
    categoria,
    genero,
    nivel_estudio_superior,
    cantidad,
    ordenar_por,
    direccion,
  } = query;

  const whereUsuario = {
    ...(genero && { genero }),
    ...(nivel_estudio_superior && {
      nivel_estudio_superior,
    }),
  };

  const filtrarPorRelacion = Boolean(edicion || categoria);

  const camposOrdenamiento = {
    numero_documento: "numero_documento",
    primer_nombre: "primer_nombre",
    primer_apellido: "primer_apellido",
    correo_electronico: "correo_electronico",
    codigo_institucional: "codigo_institucional",
    nivel_estudio_superior: "nivel_estudio_superior",
  };

  const campoOrdenamiento =
    camposOrdenamiento[ordenar_por] || "primer_apellido";

  const direccionNormalizada = String(direccion || "ASC").toUpperCase();

  const direccionOrdenamiento = ["ASC", "DESC"].includes(direccionNormalizada)
    ? direccionNormalizada
    : "ASC";

  const order = [
    [campoOrdenamiento, direccionOrdenamiento],
    ["id_usuario", "ASC"],
  ];

  const cantidadSolicitada = Number(cantidad);

  const cantidadValida =
    cantidad !== undefined &&
    cantidad !== null &&
    String(cantidad).trim() !== "" &&
    Number.isInteger(cantidadSolicitada) &&
    cantidadSolicitada > 0;

  const include = [
    {
      model: Rol,
      as: "roles",
      required: true,
      ...(tipo && {
        where: {
          id_rol: tipo,
        },
      }),
    },
  ];

  if (tipo === "3") {
    include.push({
      model: ParticipacionJurado,
      as: "evaluacionesAsignadas",
      required: filtrarPorRelacion,
      include: [
        {
          model: Participacion,
          as: "participacion",
          required: filtrarPorRelacion,
          where: {
            ...(edicion && {
              id_edicion: edicion,
            }),
            ...(categoria && {
              id_edicion_categoria: categoria,
            }),
          },
        },
      ],
    });
  }

  if (tipo === "4") {
    include.push({
      model: Participacion,
      as: "participaciones",
      required: filtrarPorRelacion,
      where: {
        ...(edicion && {
          id_edicion: edicion,
        }),
        ...(categoria && {
          id_edicion_categoria: categoria,
        }),
      },
    });
  }

  const usuariosEncontrados = await Usuario.findAll({
    attributes: ["id_usuario"],
    where: whereUsuario,
    include,
    order,
    distinct: true,
    subQuery: false,
  });

  const idsUsuarios = [
    ...new Set(usuariosEncontrados.map((usuario) => usuario.id_usuario)),
  ];

  const idsLimitados = cantidadValida
    ? idsUsuarios.slice(0, cantidadSolicitada)
    : idsUsuarios;

  if (idsLimitados.length === 0) {
    return [];
  }

  const usuarios = await Usuario.findAll({
    where: {
      ...whereUsuario,
      id_usuario: idsLimitados,
    },
    include,
    distinct: true,
    subQuery: false,
  });

  const posicionPorId = new Map(
    idsLimitados.map((id, index) => [String(id), index]),
  );

  usuarios.sort(
    (a, b) =>
      posicionPorId.get(String(a.id_usuario)) -
      posicionPorId.get(String(b.id_usuario)),
  );

  return usuarios;
};

const reportesParticipacionesPDF = async (req, res) => {
  try {
    const {
      edicion,
      categoria,
      participante,
      genero,
      nivel_estudio_superior,
      fecha_inicio,
      fecha_fin,
    } = req.query;

    const participaciones = await obtenerParticipacionesReporte(req);

    const edicionData = edicion ? await Edicion.findByPk(edicion) : null;

    const categoriaData = categoria
      ? await EdicionCategoria.findByPk(categoria, {
          include: [
            {
              model: Categoria,
              as: "categoria",
              attributes: ["nombre_categoria"],
            },
          ],
        })
      : null;

    const participanteData =
      participante && participante !== "TODOS"
        ? await Usuario.findByPk(participante)
        : null;

    const filtrosPDF = {
      ...(edicionData && {
        edicion: edicionData.nombre_edicion,
      }),

      ...(categoriaData?.categoria && {
        categoria: categoriaData.categoria.nombre_categoria,
      }),

      ...(participanteData && {
        participante: [
          participanteData.primer_nombre,
          participanteData.segundo_nombre,
          participanteData.primer_apellido,
        ]
          .filter(Boolean)
          .join(" "),
      }),

      ...(genero &&
        genero !== "TODOS" && {
          genero,
        }),

      ...(nivel_estudio_superior &&
        nivel_estudio_superior !== "TODOS" && {
          nivel_estudio_superior,
        }),

      ...(fecha_inicio && {
        fecha_inicio_postulaciones: fecha_inicio,
      }),

      ...(fecha_fin && {
        fecha_fin_postulaciones: fecha_fin,
      }),
    };

    return await generarPDF(
      "participaciones",
      participaciones,
      dayjs().format("DD/MM/YYYY"),
      filtrosPDF,
      res,
      "landscape",
    );
  } catch (error) {
    console.error("Error al generar el PDF de participaciones:", error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const reportesParticipacionesExcel = async (req, res) => {
  try {
    const {
      edicion,
      categoria,
      participante,
      genero,
      nivel_estudio_superior,
      fecha_inicio,
      fecha_fin,
    } = req.query;

    const participaciones = await obtenerParticipacionesReporte(req);

    const edicionData = edicion ? await Edicion.findByPk(edicion) : null;

    const categoriaData = categoria
      ? await EdicionCategoria.findByPk(categoria, {
          include: [
            {
              model: Categoria,
              as: "categoria",
              attributes: ["nombre_categoria"],
            },
          ],
        })
      : null;

    const participanteData =
      participante && participante !== "TODOS"
        ? await Usuario.findByPk(participante)
        : null;

    const filtrosExcel = {
      ...(edicionData && {
        edicion: edicionData.nombre_edicion,
      }),

      ...(categoriaData?.categoria && {
        categoria: categoriaData.categoria.nombre_categoria,
      }),

      ...(participanteData && {
        participante: [
          participanteData.primer_nombre,
          participanteData.segundo_nombre,
          participanteData.primer_apellido,
        ]
          .filter(Boolean)
          .join(" "),
      }),

      ...(genero &&
        genero !== "TODOS" && {
          genero,
        }),

      ...(nivel_estudio_superior &&
        nivel_estudio_superior !== "TODOS" && {
          nivel_estudio_superior,
        }),

      ...(fecha_inicio && {
        fecha_inicio_postulaciones: fecha_inicio,
      }),

      ...(fecha_fin && {
        fecha_fin_postulaciones: fecha_fin,
      }),
    };

    return await generarExcel(
      "participaciones",
      participaciones,
      dayjs().format("DD/MM/YYYY"),
      filtrosExcel,
      res,
    );
  } catch (error) {
    console.error("Error al generar el Excel de participaciones:", error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const reportesPostulacionesPDF = async (req, res) => {
  try {
    const { postulaciones, filtrosReporte } =
      await obtenerPostulacionesReporte(req);

    return await generarPDF(
      "postulaciones",
      postulaciones,
      dayjs().format("DD/MM/YYYY"),
      filtrosReporte,
      res,
      "landscape",
    );
  } catch (error) {
    console.error("Error al generar PDF de postulaciones:", error);

    return res.status(500).json({
      error: "Error al generar el PDF de postulaciones",
    });
  }
};

const reportesPostulacionesExcel = async (req, res) => {
  try {
    const { postulaciones, filtrosReporte } =
      await obtenerPostulacionesReporte(req);

    return await generarExcel(
      "postulaciones",
      postulaciones,
      dayjs().format("DD/MM/YYYY"),
      filtrosReporte,
      res,
    );
  } catch (error) {
    console.error("Error al generar Excel de postulaciones:", error);

    return res.status(500).json({
      error: "Error al generar el Excel de postulaciones",
    });
  }
};

const reportesConvocatoriasPDF = async (req, res) => {
  try {
    const { convocatorias, filtrosReporte } = await obtenerConvocatoriasReporte(
      req.query,
    );

    return await generarPDF(
      "convocatorias",
      convocatorias,
      dayjs().format("DD/MM/YYYY"),
      filtrosReporte,
      res,
    );
  } catch (error) {
    console.error("Error al generar el reporte PDF de convocatorias:", error);

    if (
      error.message === "La fecha de inicio no es válida" ||
      error.message === "La fecha de fin no es válida"
    ) {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: "Error al generar el reporte PDF",
    });
  }
};

const reportesConvocatoriasExcel = async (req, res) => {
  try {
    const { convocatorias, filtrosReporte } = await obtenerConvocatoriasReporte(
      req.query,
    );

    return await generarExcel(
      "convocatorias",
      convocatorias,
      dayjs().format("DD/MM/YYYY"),
      filtrosReporte,
      res,
    );
  } catch (error) {
    console.error("Error al generar el reporte Excel de convocatorias:", error);

    if (
      error.message === "La fecha de inicio no es válida" ||
      error.message === "La fecha de fin no es válida"
    ) {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: "Error al generar el reporte Excel",
    });
  }
};

const reportesUsuariosPDF = async (req, res) => {
  try {
    const { tipo, edicion, categoria, genero, nivel_estudio_superior } =
      req.query;

    const usuarios = await obtenerUsuariosParaReporte(req.query);

    const edicionData = edicion ? await Edicion.findByPk(edicion) : null;

    const categoriaData = categoria
      ? await EdicionCategoria.findByPk(categoria, {
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
          ],
        })
      : null;

    const rolesData = tipo ? await Rol.findByPk(tipo) : null;

    const filtrosPDF = {
      ...(rolesData && {
        tipo_de_usuario: rolesData.nombre_rol,
      }),
      ...(edicionData && {
        edicion: edicionData.nombre_edicion,
      }),
      ...(categoriaData?.categoria && {
        categoria: categoriaData.categoria.nombre_categoria,
      }),
      ...(genero && {
        género: genero,
      }),
      ...(nivel_estudio_superior && {
        nivel_estudio_superior,
      }),
      ...(req.query.cantidad &&
        Number.isInteger(Number(req.query.cantidad)) &&
        Number(req.query.cantidad) > 0 && {
          cantidad_maxima: Number(req.query.cantidad),
        }),
    };

    return await generarPDF(
      "usuarios",
      usuarios,
      dayjs().format("DD/MM/YYYY"),
      filtrosPDF,
      res,
    );
  } catch (error) {
    console.error("Error al generar el PDF de usuarios:", error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const reportesUsuariosExcel = async (req, res) => {
  try {
    const { tipo, edicion, categoria, genero, nivel_estudio_superior } =
      req.query;

    const usuarios = await obtenerUsuariosParaReporte(req.query);

    const edicionData = edicion ? await Edicion.findByPk(edicion) : null;

    const categoriaData = categoria
      ? await EdicionCategoria.findByPk(categoria, {
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
          ],
        })
      : null;

    const rolesData = tipo ? await Rol.findByPk(tipo) : null;

    const filtrosExcel = {
      ...(rolesData && {
        tipo_de_usuario: rolesData.nombre_rol,
      }),
      ...(edicionData && {
        edicion: edicionData.nombre_edicion,
      }),
      ...(categoriaData?.categoria && {
        categoria: categoriaData.categoria.nombre_categoria,
      }),
      ...(genero && {
        género: genero,
      }),
      ...(nivel_estudio_superior && {
        nivel_estudio_superior,
      }),
      ...(req.query.cantidad &&
        Number.isInteger(Number(req.query.cantidad)) &&
        Number(req.query.cantidad) > 0 && {
          cantidad_maxima: Number(req.query.cantidad),
        }),
    };

    return await generarExcel(
      "usuarios",
      usuarios,
      dayjs().format("DD/MM/YYYY"),
      filtrosExcel,
      res,
    );
  } catch (error) {
    console.error("Error al generar el Excel de usuarios:", error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

module.exports = {
  reportesParticipaciones,
  reportesPostulaciones,
  reportesConvocatorias,
  reportesUsuarios,
  reportesParticipacionesPDF,
  reportesParticipacionesExcel,
  reportesPostulacionesPDF,
  reportesPostulacionesExcel,
  reportesConvocatoriasPDF,
  reportesConvocatoriasExcel,
  reportesUsuariosPDF,
  reportesUsuariosExcel,
};

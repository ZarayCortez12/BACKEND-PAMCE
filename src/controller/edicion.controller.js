const { Op, fn, col, where } = require("sequelize");
const {
  Edicion,
  Participacion,
  Usuario,
  Categoria,
  EdicionCategoria,
  ParticipacionJurado,
  Convocatoria,
} = require("../models");
const sequelize = require("../configs/db");
const { setAuditContext } = require("../utils/audits");
const { hoyBogota } = require("../utils/fechas");

// Orden de las fechas de una edición. Entre etapas se exige que una termine
// antes de que empiece la siguiente; si no, los crons se pisan entre sí
// (por ejemplo, una premiación después de fecha_fin nunca se procesa).
const ORDEN_FECHAS = [
  ["fecha_inicio", "fecha_inicio_convocatoria", "<="],
  ["fecha_inicio_convocatoria", "fecha_fin_convocatoria", "<="],
  ["fecha_fin_convocatoria", "fecha_inicio_evaluacion", "<"],
  ["fecha_inicio_evaluacion", "fecha_fin_evaluacion", "<="],
  ["fecha_fin_evaluacion", "fecha_inicio_premiacion", "<"],
  ["fecha_inicio_premiacion", "fecha_fin_premiacion", "<="],
  ["fecha_fin_premiacion", "fecha_fin", "<="],
];

const NOMBRES_FECHAS = {
  fecha_inicio: "inicio de la edición",
  fecha_inicio_convocatoria: "inicio de la convocatoria",
  fecha_fin_convocatoria: "fin de la convocatoria",
  fecha_inicio_evaluacion: "inicio de la evaluación",
  fecha_fin_evaluacion: "fin de la evaluación",
  fecha_inicio_premiacion: "inicio de la premiación",
  fecha_fin_premiacion: "fin de la premiación",
  fecha_fin: "fin de la edición",
};

// Devuelve un mensaje de error si las fechas no son válidas, o null
const validarFechasEdicion = (fechas) => {
  for (const campo of Object.keys(NOMBRES_FECHAS)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechas[campo] ?? ""))) {
      return `Falta o no es válida la fecha de ${NOMBRES_FECHAS[campo]}.`;
    }
  }

  for (const [anterior, siguiente, operador] of ORDEN_FECHAS) {
    const a = String(fechas[anterior]);
    const b = String(fechas[siguiente]);
    const valido = operador === "<" ? a < b : a <= b;

    if (!valido) {
      return `La fecha de ${NOMBRES_FECHAS[siguiente]} debe ser ${
        operador === "<" ? "posterior a" : "igual o posterior a"
      } la fecha de ${NOMBRES_FECHAS[anterior]}.`;
    }
  }

  return null;
};

// Cambios de estado que permite la interfaz del director
const TRANSICIONES_PERMITIDAS = {
  activo: ["inactivo"],
  inactivo: ["activo"],
  en_proceso: ["cancelada"],
  cancelada: ["inactivo"],
  finalizada: ["inactivo"],
};

const listarEdiciones = async (req, res) => {
  try {
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
          model: EdicionCategoria,
          as: "categoriasEdicion",
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
          ],
        },
        {
          model: Participacion,
          as: "participaciones",
          include: [
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
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const agregarEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;

    await setAuditContext(sequelize, req, transaction);

    const nuevaEdicion = {
      nombre_edicion: req.body.nombre_edicion,
      fecha_inicio: req.body.fecha_inicio,
      fecha_fin: req.body.fecha_fin,
      fecha_inicio_convocatoria: req.body.fecha_inicio_convocatoria,
      fecha_fin_convocatoria: req.body.fecha_fin_convocatoria,
      fecha_inicio_evaluacion: req.body.fecha_inicio_evaluacion,
      fecha_fin_evaluacion: req.body.fecha_fin_evaluacion,
      fecha_inicio_premiacion: req.body.fecha_inicio_premiacion,
      fecha_fin_premiacion: req.body.fecha_fin_premiacion,
      estado_edicion: "activo",
      fecha_registro: new Date(),
    };

    const errorFechas = validarFechasEdicion(nuevaEdicion);

    if (errorFechas) {
      await transaction.rollback();
      return res.status(400).json({ message: errorFechas });
    }

    const hayEdicion = await Edicion.findOne({
      where: { nombre_edicion: nuevaEdicion.nombre_edicion },
      transaction,
    });

    if (hayEdicion) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Ya existe una edición con ese nombre" });
    }

    const edicionConflictiva = await Edicion.findOne({
      where: {
        estado_edicion: {
          [Op.notIn]: ["inactivo", "cancelada"],
        },
        fecha_eliminacion: null,
        [Op.or]: [
          {
            fecha_inicio: {
              [Op.between]: [nuevaEdicion.fecha_inicio, nuevaEdicion.fecha_fin],
            },
          },
          {
            fecha_fin: {
              [Op.between]: [nuevaEdicion.fecha_inicio, nuevaEdicion.fecha_fin],
            },
          },
          {
            [Op.and]: [
              { fecha_inicio: { [Op.lte]: nuevaEdicion.fecha_inicio } },
              { fecha_fin: { [Op.gte]: nuevaEdicion.fecha_fin } },
            ],
          },
          {
            [Op.and]: [
              { fecha_inicio: { [Op.gte]: nuevaEdicion.fecha_inicio } },
              { fecha_fin: { [Op.lte]: nuevaEdicion.fecha_fin } },
            ],
          },
        ],
      },
      transaction,
    });

    if (edicionConflictiva) {
      await transaction.rollback();
      return res.status(401).json({
        message: "La edición tiene fechas que se cruzan con otra edición",
      });
    }

    const edicionCreada = await Edicion.create(nuevaEdicion, {
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      message: "Edición creada correctamente",
      edicion: edicionCreada,
    });
  } catch (error) {
    await transaction.rollback();
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerEdicion = async (req, res) => {
  try {
    const { idEdicion } = req.params;

    const edicion = await Edicion.findOne({
      where: { id_edicion: idEdicion },
    });

    if (!edicion) {
      return res.status(404).json({ message: "Edición no encontrada" });
    }

    return res.json({
      message: "Información obtenida correctamente",
      edicion: edicion,
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const editarEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;

    await setAuditContext(sequelize, req, transaction);

    const { idEdicion } = req.params;

    const edicionModificada = {
      nombre_edicion: req.body.nombre_edicion,
      fecha_inicio: req.body.fecha_inicio,
      fecha_fin: req.body.fecha_fin,
      fecha_inicio_convocatoria: req.body.fecha_inicio_convocatoria,
      fecha_fin_convocatoria: req.body.fecha_fin_convocatoria,
      fecha_inicio_evaluacion: req.body.fecha_inicio_evaluacion,
      fecha_fin_evaluacion: req.body.fecha_fin_evaluacion,
      fecha_inicio_premiacion: req.body.fecha_inicio_premiacion,
      fecha_fin_premiacion: req.body.fecha_fin_premiacion,
      fecha_actualizacion: new Date(),
    };

    const edicion = await Edicion.findOne({
      where: { id_edicion: idEdicion },
      transaction,
    });

    if (!edicion) {
      await transaction.rollback();
      return res.status(404).json({ message: "Edición no encontrada" });
    }

    const cambianFechas = Object.keys(NOMBRES_FECHAS).some(
      (campo) => String(edicion[campo]) !== String(edicionModificada[campo]),
    );

    if (edicion.fecha_procesamiento_premiacion && cambianFechas) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "No se pueden cambiar las fechas: la premiación de esta edición ya fue procesada.",
      });
    }

    const errorFechas = validarFechasEdicion(edicionModificada);

    if (errorFechas) {
      await transaction.rollback();
      return res.status(400).json({ message: errorFechas });
    }

    const edicionConflictiva = await Edicion.findOne({
      where: {
        id_edicion: { [Op.ne]: edicion.id_edicion },
        estado_edicion: {
          [Op.notIn]: ["inactivo", "cancelada", "finalizada"],
        },
        [Op.or]: [
          {
            fecha_inicio: {
              [Op.between]: [
                edicionModificada.fecha_inicio,
                edicionModificada.fecha_fin,
              ],
            },
          },
          {
            fecha_fin: {
              [Op.between]: [
                edicionModificada.fecha_inicio,
                edicionModificada.fecha_fin,
              ],
            },
          },
          {
            [Op.and]: [
              { fecha_inicio: { [Op.lte]: edicionModificada.fecha_inicio } },
              { fecha_fin: { [Op.gte]: edicionModificada.fecha_fin } },
            ],
          },
          {
            [Op.and]: [
              { fecha_inicio: { [Op.gte]: edicionModificada.fecha_inicio } },
              { fecha_fin: { [Op.lte]: edicionModificada.fecha_fin } },
            ],
          },
        ],
      },
      transaction,
    });

    if (edicionConflictiva) {
      await transaction.rollback();
      return res.status(401).json({
        message:
          "No se puede editar. La edición tiene fechas que se cruzan con otra edición",
      });
    }

    await Edicion.update(edicionModificada, {
      where: { id_edicion: edicion.id_edicion },
      transaction,
    });

    const edicionActualizada = await Edicion.findOne({
      where: { id_edicion: edicion.id_edicion },
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      message: "Edición actualizada correctamente",
      edicion: edicionActualizada,
    });
  } catch (error) {
    console.log(error);
    await transaction.rollback();
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const cambiarEstado = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { idEdicion } = req.params;
    const { estado, observacion } = req.body.data;
    req.audit.usuario_id = req.user.data.id_usuario;

    if (estado === "activo") {
      req.audit.metodo = "ACTIVATE";
    } else if (estado === "inactivo") {
      req.audit.metodo = "INACTIVE";
    } else {
      req.audit.metodo = "CHANGE_STATE";
    }

    await setAuditContext(sequelize, req, transaction);

    const edicion = await Edicion.findOne({
      where: { id_edicion: idEdicion },
      transaction,
    });

    if (!edicion) {
      await transaction.rollback();
      return res.status(404).json({ message: "Edición no encontrada" });
    }

    const permitidos = TRANSICIONES_PERMITIDAS[edicion.estado_edicion] || [];

    if (!permitidos.includes(estado)) {
      await transaction.rollback();
      return res.status(400).json({
        message: `No se puede pasar una edición de "${edicion.estado_edicion}" a "${estado}".`,
      });
    }

    if (estado === "cancelada" && !String(observacion ?? "").trim()) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Debe ingresar el motivo de la cancelación.",
      });
    }

    if (estado === "activo") {
      const edicionConflictiva = await Edicion.findOne({
        where: {
          id_edicion: { [Op.ne]: edicion.id_edicion },
          estado_edicion: {
            [Op.notIn]: ["inactivo", "cancelada", "finalizada"],
          },
          [Op.or]: [
            {
              fecha_inicio: {
                [Op.between]: [edicion.fecha_inicio, edicion.fecha_fin],
              },
            },
            {
              fecha_fin: {
                [Op.between]: [edicion.fecha_inicio, edicion.fecha_fin],
              },
            },
            {
              [Op.and]: [
                { fecha_inicio: { [Op.lte]: edicion.fecha_inicio } },
                { fecha_fin: { [Op.gte]: edicion.fecha_fin } },
              ],
            },
            {
              [Op.and]: [
                { fecha_inicio: { [Op.gte]: edicion.fecha_inicio } },
                { fecha_fin: { [Op.lte]: edicion.fecha_fin } },
              ],
            },
          ],
        },
        transaction,
      });

      if (edicionConflictiva) {
        await transaction.rollback();
        return res.status(401).json({
          message:
            "No se puede activar. La edición tiene fechas que se cruzan con otra edición",
        });
      }

      // Si hoy ya cae dentro de las fechas, la edición pasa directo a en_proceso
      // (antes se usaba edicion.fecha_final, que no existe, y nunca pasaba)
      const hoy = hoyBogota();
      const inicio = String(edicion.fecha_inicio);
      const fin = String(edicion.fecha_fin);

      if (hoy >= inicio && hoy <= fin) {
        const otraEnProceso = await Edicion.findOne({
          where: { estado_edicion: "en_proceso" },
          transaction,
        });

        if (otraEnProceso && otraEnProceso.id_edicion !== edicion.id_edicion) {
          await transaction.rollback();
          return res.status(400).json({
            message:
              "No se puede cambiar el estado de la Edición. Ya existe otra edición en proceso. Solo puede haber una.",
          });
        }
        edicion.estado_edicion = "en_proceso";
        edicion.fecha_eliminacion = null;
      } else {
        edicion.estado_edicion = "activo";
        edicion.fecha_eliminacion = null;
      }
    } else {
      edicion.estado_edicion = estado;
      edicion.observacion = observacion;
      edicion.fecha_actualizacion = new Date();
      edicion.fecha_eliminacion = null;
      if (estado === "inactivo") {
        edicion.fecha_eliminacion = new Date();
      }
    }

    await edicion.save({ transaction });

    const edicionActualizada = await Edicion.findOne({
      where: { id_edicion: edicion.id_edicion },
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      message: "Edición actualizada correctamente",
      edicion: edicionActualizada,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const eliminarEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;

    await setAuditContext(sequelize, req, transaction);

    const edicion = await Edicion.findOne({
      where: { id_edicion: req.params.idEdicion },
      transaction,
    });

    if (!edicion) {
      await transaction.rollback();
      return res.status(404).json({ message: "Edición no encontrada" });
    }

    await edicion.destroy({ transaction });

    await transaction.commit();

    res.status(200).json({ message: "Edición eliminada correctamente" });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerEdicionEnProceso = async (req, res) => {
  try {
    const edicion = await Edicion.findOne({
      where: { estado_edicion: "en_proceso" },
    });

    res.json(edicion);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

const obtenerInformacionEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;

    const edicion = await Edicion.findOne({
      where: { id_edicion: id_edicion },
    });

    const participaciones = await Participacion.findAll({
      where: { id_edicion: edicion.id_edicion },
      attributes: [
        "id_participacion",
        "estado",
        "fecha_postulacion",
        "fecha_revision",
        "observacion",
        "comentarios",
        "calificacion_final",
        "fecha_resultados",
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
            "fecha_registro",
            "estado",
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
    });

    const participacionesPendientes = await Participacion.findAll({
      where: { id_edicion: edicion.id_edicion, estado: "pendiente" },
      attributes: [
        "id_participacion",
        "estado",
        "fecha_postulacion",
        "fecha_revision",
        "observacion",
        "comentarios",
        "calificacion_final",
        "fecha_resultados",
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
            "fecha_registro",
            "estado",
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
    });

    const categorias = await EdicionCategoria.findAll({
      where: { id_edicion: edicion.id_edicion },
      attributes: [
        "id_categoria",
        "descripcion",
        "numero_ganadores",
        "estado",
        "id_edicion_categoria",
        "fecha_registro",
      ],
      include: [
        {
          model: Categoria,
          as: "categoria",
          attributes: ["id_categoria", "nombre_categoria"],
        },
      ],
    });

    const categoriasActivas = categorias.filter((c) => c.estado === "activo");

    const categoriasActivasMap = new Map();

    for (const categoriaEdicion of categoriasActivas) {
      categoriasActivasMap.set(categoriaEdicion.id_edicion_categoria, {
        id_edicion_categoria: categoriaEdicion.id_edicion_categoria,
        numero_ganadores: categoriaEdicion.numero_ganadores,
        descripcion: categoriaEdicion.descripcion,
        categoria: {
          id_categoria: categoriaEdicion.categoria.id_categoria,
          nombre_categoria: categoriaEdicion.categoria.nombre_categoria,
        },
        participaciones: [],
      });
    }

    for (const participacion of participaciones) {
      const idEdicionCategoria =
        participacion.edicionCategoria?.id_edicion_categoria;

      if (categoriasActivasMap.has(idEdicionCategoria)) {
        categoriasActivasMap
          .get(idEdicionCategoria)
          .participaciones.push(participacion);
      }
    }

    const categoriasActivasConParticipaciones = Array.from(
      categoriasActivasMap.values(),
    );

    const categoriasMap = new Map();

    for (const categoriaEdicion of categorias) {
      categoriasMap.set(categoriaEdicion.id_edicion_categoria, {
        id_edicion_categoria: categoriaEdicion.id_edicion_categoria,
        numero_ganadores: categoriaEdicion.numero_ganadores,
        estado: categoriaEdicion.estado,
        fecha_registro: categoriaEdicion.fecha_registro,
        descripcion: categoriaEdicion.descripcion,
        categoria: {
          id_categoria: categoriaEdicion.categoria.id_categoria,
          nombre_categoria: categoriaEdicion.categoria.nombre_categoria,
        },
        participaciones: [],
        postulaciones: [],
      });
    }

    for (const participacion of participaciones) {
      const idEdicionCategoria =
        participacion.edicionCategoria?.id_edicion_categoria;

      if (categoriasMap.has(idEdicionCategoria)) {
        categoriasMap
          .get(idEdicionCategoria)
          .participaciones.push(participacion);
      }
    }

    for (const postulacion of participacionesPendientes) {
      const idEdicionCategoria =
        postulacion.edicionCategoria?.id_edicion_categoria;

      if (categoriasMap.has(idEdicionCategoria)) {
        categoriasMap.get(idEdicionCategoria).postulaciones.push(postulacion);
      }
    }

    const categoriasConParticipaciones = Array.from(categoriasMap.values());

    const jurados = await ParticipacionJurado.findAll({
      attributes: ["id_jurado", "estado", "fecha_asignacion", "observacion"],
      include: [
        {
          model: Usuario,
          as: "jurado",
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
          model: Participacion,
          as: "participacion",
          where: { id_edicion: edicion.id_edicion },
          attributes: [
            "id_participacion",
            "estado",
            "fecha_postulacion",
            "fecha_revision",
            "observacion",
            "comentarios",
            "calificacion_final",
            "fecha_resultados",
          ],
        },
      ],
    });

    const juradosMap = new Map();

    for (const item of jurados) {
      const jurado = item.jurado;
      const participacion = item.participacion;

      if (!jurado) continue;

      if (!juradosMap.has(jurado.id_usuario)) {
        juradosMap.set(jurado.id_usuario, {
          ...jurado.toJSON(),
          participaciones: [],
        });
      }

      if (participacion) {
        juradosMap.get(jurado.id_usuario).participaciones.push(participacion);
      }
    }

    const juradosUnicos = Array.from(juradosMap.values());

    const convocados = await Convocatoria.findAll({
      where: { id_edicion: edicion.id_edicion },
      attributes: [
        "id_convocatoria",
        "correo_electronico",
        "estado_envio",
        "fecha_envio",
        "intentos_envio",
        "fecha_respuesta",
      ],
    });

    if (!edicion) {
      return res.status(404).json({ message: "No hay ediciones en proceso" });
    }

    const edicionResponse = {
      id_edicion: edicion.id_edicion,
      nombre_edicion: edicion.nombre_edicion,
      fecha_inicio: edicion.fecha_inicio,
      fecha_fin: edicion.fecha_fin,
      fecha_inicio_convocatoria: edicion.fecha_inicio_convocatoria,
      fecha_fin_convocatoria: edicion.fecha_fin_convocatoria,
      fecha_inicio_evaluacion: edicion.fecha_inicio_evaluacion,
      fecha_fin_evaluacion: edicion.fecha_fin_evaluacion,
      fecha_inicio_premiacion: edicion.fecha_inicio_premiacion,
      fecha_fin_premiacion: edicion.fecha_fin_premiacion,
      estado_edicion: edicion.estado_edicion,
      fecha_registro: edicion.fecha_registro,
      fecha_actualizacion: edicion.fecha_actualizacion,
      observacion: edicion.observacion,
      participaciones,
      participacionesPendientes,
      categorias: categoriasConParticipaciones,
      categoriasActivas: categoriasActivasConParticipaciones,
      jurados: juradosUnicos,
      convocados,
    };

    return res.json({
      message: "Edición obtenida correctamente",
      edicionObtenida: edicionResponse,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerEdicionesPorJurado = async (req, res) => {
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
      message: "Ediciones obtenidas correctamenteee",
      ediciones,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerEdicionesPorParticipante = async (req, res) => {
  try {
    const { id_participante } = req.params;

    const ediciones = await Edicion.findAll({
      include: [
        {
          model: Participacion,
          as: "participaciones",
          required: true,
          where: { id_usuario: id_participante },
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

module.exports = {
  listarEdiciones,
  agregarEdicion,
  obtenerEdicion,
  editarEdicion,
  cambiarEstado,
  eliminarEdicion,
  obtenerEdicionEnProceso,
  obtenerInformacionEdicion,
  obtenerEdicionesPorJurado,
  obtenerEdicionesPorParticipante,
};

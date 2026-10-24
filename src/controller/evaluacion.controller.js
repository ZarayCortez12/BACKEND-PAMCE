const jwt = require("jsonwebtoken");
const sequelize = require("../configs/db");
const {
  Rubrica,
  RubricaCriterio,
  Criterio,
  EdicionCategoriaRubrica,
  EdicionCategoriaRubricaCriterio,
  EvaluacionCriterio,
  Participacion,
  ParticipacionJurado,
} = require("../models");

const listarRubricasConCriterios = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const rubricas = await Rubrica.findAll({
      attributes: ["id_rubrica", "nombre", "descripcion"],
      include: [
        {
          model: RubricaCriterio,
          attributes: [
            "id_rubrica_criterio",
            "id_criterio",
            "id_rubrica",
            "id_criterio",
            "id_rubrica",
          ],
          include: [
            {
              model: Criterio,
              attributes: ["id_criterio", "nombre", "descripcion"],
            },
          ],
        },
      ],
    });

    if (!rubricas || rubricas.length === 0) {
      return res.status(404).json({
        message: "No hay rubricas registradas",
      });
    }

    return res.json({
      message: "Rubricas obtenidas correctamente",
      rubricas,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const editarPorcentajeCriterio = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { id_ecrc } = req.params;
    const { porcentaje } = req.body;

    const criterio = await EdicionCategoriaRubricaCriterio.findOne({
      where: {
        id_ecrc: id_ecrc,
      },
    });

    if (!criterio) {
      return res.status(404).json({
        message: "No se ha encontrado el criterio",
      });
    }

    criterio.porcentaje = porcentaje;

    await criterio.save();

    return res.json({
      message: "Se ha actualizado el criterio",
      criterio,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const { Op } = require("sequelize");

const listarRubricasFiltradasCategoria = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { id_edicion_categoria } = req.params;

    const usados = await EdicionCategoriaRubricaCriterio.findAll({
      where: { id_edicion_categoria: id_edicion_categoria },
      include: [
        {
          model: RubricaCriterio,
          attributes: ["id_criterio"],
        },
      ],
    });

    const criteriosUsados = usados.map((u) => u.RubricaCriterio.id_criterio);

    const rubricasAsignadas = await EdicionCategoriaRubrica.findAll({
      where: { id_edicion_categoria },
      attributes: ["id_rubrica"],
    });

    const idsRubricasAsignadas = rubricasAsignadas.map((r) => r.id_rubrica);

    const rubricasDisponibles = await Rubrica.findAll({
      where: {
        id_rubrica: {
          [Op.notIn]: idsRubricasAsignadas.length ? idsRubricasAsignadas : [0], 
        },
      },
      include: [
        {
          model: RubricaCriterio,
          include: [
            {
              model: Criterio,
              attributes: ["id_criterio", "nombre", "descripcion"],
            },
          ],
        },
      ],
      distinct: true,
    });

    const rubricasLibres = rubricasDisponibles.filter((rubrica) => {
      const criteriosDeRubrica = rubrica.RubricaCriterios.map(
        (rc) => rc.id_criterio,
      );

      const tieneRepetidos = criteriosDeRubrica.some((id) =>
        criteriosUsados.includes(id),
      );

      return !tieneRepetidos;
    });

    return res.json({
      message: "Rubricas disponibles",
      rubricas: rubricasLibres,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerRubricaCriterios = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { id_rubrica } = req.params;

    const rubrica = await Rubrica.findOne({
      where: {
        id_rubrica: id_rubrica,
      },
      include: [
        {
          model: RubricaCriterio,
          include: [
            {
              model: Criterio,
              attributes: ["id_criterio", "nombre", "descripcion"],
            },
          ],
        },
      ],
    });

    if (!rubrica || rubrica.length === 0) {
      return res.status(404).json({
        message: "No se ha encontrado la rubrica",
      });
    }

    return res.json({
      message: "Rubrica obtenida correctamente",
      rubrica,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const agregarRubricaAEdicionCategoria = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { id_edicion_categoria } = req.params;

    const { id_rubrica, porcentaje } = req.body;

    await EdicionCategoriaRubrica.create({
      id_edicion_categoria,
      id_rubrica,
      porcentaje,
    });

    return res.json({
      message: "Rubrica agregada correctamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const agregarPorcentajesCriterio = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { id_edicion_categoria } = req.params;
    const { porcentajesCriterios } = req.body;

    if (!porcentajesCriterios || typeof porcentajesCriterios !== "object") {
      return res.status(400).json({
        message: "No se recibieron porcentajes válidos",
      });
    }

    const registros = Object.entries(porcentajesCriterios).map(
      ([idRubricaCriterio, porcentaje]) => ({
        id_edicion_categoria,
        id_rubrica_criterio: Number(idRubricaCriterio),
        porcentaje,
      }),
    );

    await EdicionCategoriaRubricaCriterio.bulkCreate(registros);

    return res.json({
      message: "Porcentajes guardados correctamente",
      total: registros.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const editarPorcentajeRubrica = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { id_ecr } = req.params;
    const { porcentaje } = req.body;

    const rubrica = await EdicionCategoriaRubrica.findOne({
      where: {
        id_ecr: id_ecr,
      },
    });

    if (!rubrica) {
      return res.status(404).json({
        message: "No se ha encontrado la rubrica",
      });
    }

    rubrica.porcentaje = porcentaje;

    await rubrica.save();

    return res.json({
      message: "Se ha actualizado la rubrica",
      rubrica,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const eliminarRubricaDeEdicionCategoria = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { id_ecr } = req.params;
    const { id_edicion_categoria } = req.body;

    const relacion = await EdicionCategoriaRubrica.findOne({
      where: {
        id_ecr,
        id_edicion_categoria,
      },
      transaction,
    });

    if (!relacion) {
      await transaction.rollback();

      return res.status(404).json({
        message: "No se encontró la relación",
      });
    }

    const id_rubrica = relacion.id_rubrica;

    const rubricaCriterios = await RubricaCriterio.findAll({
      where: {
        id_rubrica,
      },
      attributes: ["id_rubrica_criterio"],
      transaction,
    });

    const idsRC = rubricaCriterios.map((rc) => rc.id_rubrica_criterio);

    if (idsRC.length > 0) {
      await EdicionCategoriaRubricaCriterio.destroy({
        where: {
          id_edicion_categoria,
          id_rubrica_criterio: idsRC,
        },
        transaction,
      });
    }

    await relacion.destroy({ transaction });

    await transaction.commit();

    return res.json({
      message: "Rúbrica removida de la categoría correctamente",
      id_ecr,
    });
  } catch (error) {
    console.error(error);

    await transaction.rollback();

    res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const crearRubrica = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { rubrica } = req.body;

    const existeRubrica = await Rubrica.findOne({
      where: {
        nombre: rubrica.nombre,
      },
    });

    if (existeRubrica) {
      return res.status(400).json({
        message: "Ya existe una rúbrica con ese nombre",
      });
    }

    const nuevaRubrica = await Rubrica.create({
      nombre: rubrica.nombre,
      descripcion: rubrica.descripcion,
      estado: "activo",
      fecha_creacion: new Date(),
    });

    return res.json({
      message: "Rubrica creada correctamente",
      rubrica: nuevaRubrica,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const crearCriterio = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { criterio } = req.body;

    const existeCriterio = await Criterio.findOne({
      where: {
        nombre: criterio.nombre,
      },
    });

    if (existeCriterio) {
      return res.json({
        criterio: existeCriterio,
      });
    }

    const nuevoCriterio = await Criterio.create({
      nombre: criterio.nombre,
      descripcion: criterio.descripcion,
      estado: "activo",
      fecha_creacion: new Date(),
    });

    return res.json({
      message: "Criterio creado correctamente",
      criterio: nuevoCriterio,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const crearRubricaCriterio = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { id_rubrica, id_criterio } = req.body;

    const nuevaRubricaCriterio = await RubricaCriterio.create({
      id_rubrica,
      id_criterio,
    });

    return res.json({
      message: "Rubrica y criterio creados correctamente",
      rubricaCriterio: nuevaRubricaCriterio,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerEvaluaciones = async (req, res) => {
  try {
    const { id_participacion_jurado } = req.params;

    const evaluaciones = await EvaluacionCriterio.findAll({
      where: {
        id_participacion_jurado: id_participacion_jurado,
      },
      attributes: [
        "id_participacion_jurado",
        "id_edicion_categoria_rubrica_criterio",
        "calificacion",
        "observacion",
        "fecha_evaluacion",
      ],
      include: [
        {
          model: EdicionCategoriaRubricaCriterio,
          as: "edicionCategoriaRubricaCriterio",
        },
      ],
    });

    if (!evaluaciones || evaluaciones.length === 0) {
      return res.status(404).json({
        message: "No hay evaluaciones registradas para esta participación",
      });
    }

    return res.json({
      message: "Evaluaciones obtenidas correctamente",
      evaluaciones,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

module.exports = {
  listarRubricasConCriterios,
  editarPorcentajeCriterio,
  listarRubricasFiltradasCategoria,
  agregarRubricaAEdicionCategoria,
  agregarPorcentajesCriterio,
  editarPorcentajeRubrica,
  eliminarRubricaDeEdicionCategoria,
  crearRubrica,
  crearCriterio,
  crearRubricaCriterio,
  obtenerRubricaCriterios,
  obtenerEvaluaciones,
};

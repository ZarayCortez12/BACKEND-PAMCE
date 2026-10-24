const { Op, fn, col, where } = require("sequelize");
const { DataTypes } = require("sequelize");
require("../models/edicionCategoriaModel");
const jwt = require("jsonwebtoken");
const {
  Categoria,
  Edicion,
  EdicionCategoria,
  Participacion,
  ParticipacionJurado,
  Usuario,
  EdicionCategoriaRubrica,
  Rubrica,
  RubricaCriterio,
  Criterio,
  EdicionCategoriaRubricaCriterio,
} = require("../models");
const sequelize = require("../configs/db");
const { setAuditContext } = require("../utils/audits");
const { id } = require("zod/locales");

const listarRubricasPorCategoriaEdicion = async (req, res) => {
  try {
    const { id_edicion_categoria } = req.params;
    const { search = "", page, limit } = req.query;

    const queryOptions = {
      where: {
        id_edicion_categoria,
      },
      include: [
        {
          model: Rubrica,
          as: "rubrica",
          where: {
            ...(search && {
              nombre: { [Op.iLike]: `%${search}%` },
            }),
          },
          include: [
            {
              model: RubricaCriterio,
              required: false,
              include: [
                {
                  model: Criterio,
                },
                {
                  model: EdicionCategoriaRubricaCriterio,
                  as: "edicionCategoriaRubricaCriterio",
                  required: false,
                  where: {
                    id_edicion_categoria,
                  },
                },
              ],
            },
          ],
          required: true,
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
      await EdicionCategoriaRubrica.findAndCountAll(queryOptions);

    const todasLasRubricas = await EdicionCategoriaRubrica.findAll({
      where: {
        id_edicion_categoria,
      },
      attributes: ["porcentaje"],
      raw: true,
    });

    const totalPorcentajeRubricas = todasLasRubricas.reduce(
      (total, rubrica) => total + Number(rubrica.porcentaje || 0),
      0,
    );

    return res.json({
      message: "Rubricas obtenidas correctamente",
      rubricas: rows,
      total_porcentaje_rubricas: totalPorcentajeRubricas,
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

const crearRubrica = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { rubrica } = req.body;

    const existeRubrica = await Rubrica.findOne({
      where: { nombre: rubrica.nombre },
      transaction,
    });

    if (existeRubrica) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Ya existe una rúbrica con ese nombre",
      });
    }

    const nuevaRubrica = await Rubrica.create(
      {
        nombre: rubrica.nombre,
        descripcion: rubrica.descripcion,
        estado: "activo",
        fecha_creacion: new Date(),
      },
      { transaction },
    );

    await transaction.commit();

    return res.json({
      message: "Rubrica creada correctamente",
      rubrica: nuevaRubrica,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const crearRubricaCriterio = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_rubrica, id_criterio } = req.body;

    const rubrica = await Rubrica.findByPk(id_rubrica, {
      transaction,
    });

    if (!rubrica) {
      await transaction.rollback();
      return res.status(404).json({ message: "Rúbrica no encontrada" });
    }

    const criterio = await Criterio.findByPk(id_criterio, {
      transaction,
    });

    if (!criterio) {
      await transaction.rollback();
      return res.status(404).json({ message: "Criterio no encontrada" });
    }

    const rubricaCriterio = await RubricaCriterio.findOne({
      where: {
        id_rubrica: id_rubrica,
        id_criterio: id_criterio,
      },
      transaction,
    });

    if (rubricaCriterio) {
      await transaction.rollback();
      return res.status(200).json({
        rubricaCriterio,
      });
    }

    const nuevaRubricaCriterio = await RubricaCriterio.create(
      {
        id_rubrica,
        id_criterio,
      },
      { transaction },
    );

    const rubrica_nueva = await Rubrica.findByPk(
      nuevaRubricaCriterio.id_rubrica,
      {
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
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      message: "Rubrica y criterio creados correctamente",
      rubrica: rubrica_nueva,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const agregarRubricaAEdicionCategoria = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    req.audit.usuario_id = req.user.data.id_usuario;

    await setAuditContext(sequelize, req, transaction);

    const { id_edicion_categoria } = req.params;
    const { id_rubrica, porcentaje } = req.body;

    const edicionCategoria = await EdicionCategoria.findByPk(
      id_edicion_categoria,
      { transaction },
    );

    if (!edicionCategoria) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Categoría de la edición no encontrada",
      });
    }

    const rubrica = await Rubrica.findByPk(id_rubrica, {
      transaction,
    });

    if (!rubrica) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Rúbrica no encontrada",
      });
    }

    const rubricaYaAsociada = await EdicionCategoriaRubrica.findOne({
      where: {
        id_edicion_categoria,
        id_rubrica,
      },
      transaction,
    });

    if (rubricaYaAsociada) {
      await transaction.rollback();

      return res.status(400).json({
        message: "La rúbrica ya está asociada a esta categoría.",
      });
    }

    const criteriosNuevaRubrica = await RubricaCriterio.findAll({
      where: {
        id_rubrica,
      },
      include: [
        {
          model: Criterio,
          attributes: ["id_criterio", "nombre"],
        },
      ],
      transaction,
    });

    const rubricasAsociadas = await EdicionCategoriaRubrica.findAll({
      where: {
        id_edicion_categoria,
      },
      attributes: ["id_ecr", "id_rubrica"],
      transaction,
    });

    const idsRubricasAsociadas = rubricasAsociadas.map(
      (item) => item.id_rubrica,
    );

    const criteriosYaAsociados = await RubricaCriterio.findAll({
      where: {
        id_rubrica: idsRubricasAsociadas,
      },
      include: [
        {
          model: Criterio,
          attributes: ["id_criterio", "nombre"],
        },
      ],
      transaction,
    });

    const criteriosRepetidos = criteriosNuevaRubrica.filter((nuevoCriterio) =>
      criteriosYaAsociados.some(
        (criterioExistente) =>
          criterioExistente.id_criterio === nuevoCriterio.id_criterio,
      ),
    );

    if (criteriosRepetidos.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "No se puede asociar la rúbrica porque contiene criterios que ya están siendo utilizados en esta categoría.",
        criterios_repetidos: criteriosRepetidos.map((item) => ({
          id_criterio: item.id_criterio,
          nombre: item.Criterio?.nombre,
        })),
      });
    }

    await EdicionCategoriaRubrica.create(
      {
        id_edicion_categoria: edicionCategoria.id_edicion_categoria,
        id_rubrica: rubrica.id_rubrica,
        porcentaje,
      },
      { transaction },
    );

    await transaction.commit();

    return res.json({
      message: "Rúbrica agregada correctamente",
    });
  } catch (error) {
    await transaction.rollback();

    console.error(error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const listarRubricas = async (req, res) => {
  try {
    const rubricas = await Rubrica.findAll({
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

    return res.json({
      message: "Rubricas obtenidas correctamente",
      rubricas: rubricas,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerRubricaCriterios = async (req, res) => {
  try {
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

const editarPorcentajeRubrica = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_ecr } = req.params;
    const { porcentaje } = req.body;

    const rubrica = await EdicionCategoriaRubrica.findOne({
      where: {
        id_ecr: id_ecr,
      },
      transaction,
    });

    if (!rubrica) {
      await transaction.rollback();
      return res.status(404).json({
        message: "No se ha encontrado la rubrica",
      });
    }

    rubrica.porcentaje = porcentaje;

    await rubrica.save({ transaction });

    await transaction.commit();

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
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

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

module.exports = {
  listarRubricasPorCategoriaEdicion,
  crearRubrica,
  crearRubricaCriterio,
  agregarRubricaAEdicionCategoria,
  listarRubricas,
  obtenerRubricaCriterios,
  editarPorcentajeRubrica,
  eliminarRubricaDeEdicionCategoria,
};

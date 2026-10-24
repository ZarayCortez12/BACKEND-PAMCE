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

const listarCriteriosPorRubricaPorCategoriaEdicion = async (req, res) => {
  try {
    const { id_rubrica, id_edicion_categoria } = req.params;
    const { search = "", page, limit } = req.query;

    const queryOptions = {
      where: {
        ...(search && {
          nombre: { [Op.iLike]: `%${search}%` },
        }),
      },
      include: [
        {
          model: RubricaCriterio,
          as: "rubricaCriterio",
          where: { id_rubrica },
          required: true,
          include: [
            {
              model: EdicionCategoriaRubricaCriterio,
              as: "edicionCategoriaRubricaCriterio",
              required: true,
              where: {
                id_edicion_categoria,
              },
            },
          ],
        },
      ],
      distinct: true,
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Criterio.findAndCountAll(queryOptions);

    return res.json({
      message: "Criterios obtenidos correctamente",
      criterios: rows,
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

const crearCriterio = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { criterio } = req.body;

    const existeCriterio = await Criterio.findOne({
      where: { nombre: criterio.nombre },
      transaction,
    });

    if (existeCriterio) {
      await transaction.rollback();
      return res.json({
        criterio: existeCriterio,
      });
    }

    const nuevoCriterio = await Criterio.create(
      {
        nombre: criterio.nombre,
        descripcion: criterio.descripcion,
        estado: "activo",
        fecha_creacion: new Date(),
      },
      { transaction },
    );

    await transaction.commit();

    return res.json({
      message: "Criterio creado correctamente",
      criterio: nuevoCriterio,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const agregarPorcentajesCriterio = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_edicion_categoria } = req.params;
    const { porcentajesCriterios } = req.body;

    if (!porcentajesCriterios || typeof porcentajesCriterios !== "object") {
      await transaction.rollback();
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

    await EdicionCategoriaRubricaCriterio.bulkCreate(registros, {
      transaction,
    });

    await transaction.commit();

    return res.json({
      message: "Porcentajes guardados correctamente",
      total: registros.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const editarPorcentajeCriterio = async (req, res) => {
  try {
    const transaction = await sequelize.transaction();
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_ecrc } = req.params;
    const { porcentaje } = req.body;

    const criterio = await EdicionCategoriaRubricaCriterio.findOne({
      where: {
        id_ecrc: id_ecrc,
      },
      transaction,
    });

    if (!criterio) {
      await transaction.rollback();
      return res.status(404).json({
        message: "No se ha encontrado el criterio",
      });
    }

    criterio.porcentaje = porcentaje;

    await criterio.save({ transaction });

    await transaction.commit();

    return res.json({
      message: "Se ha actualizado el criterio",
      criterio,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

module.exports = {
  listarCriteriosPorRubricaPorCategoriaEdicion,
  crearCriterio,
  agregarPorcentajesCriterio,
  editarPorcentajeCriterio
};

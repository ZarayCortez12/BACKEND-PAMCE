const { Op, col, where } = require("sequelize");
require("../models/edicionCategoriaModel");
const jwt = require("jsonwebtoken");
const {
  Categoria,
  Edicion,
  EdicionCategoria,
  Participacion,
  Usuario,
} = require("../models");
const sequelize = require("../configs/db");
const { setAuditContext } = require("../utils/audits");
const NotificacionService = require("../middlewares/notificaciones.js");

const listarCategoriasPorEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;

    const { search = "", estado, page, limit } = req.query;

    const queryOptions = {
      where: {
        ...(search && {
          [Op.or]: [
            {
              nombre_categoria: {
                [Op.iLike]: `%${search}%`,
              },
            },
            {
              "$edicionesCategoria.descripcion$": {
                [Op.iLike]: `%${search}%`,
              },
            },
          ],
        }),
      },
      include: [
        {
          model: EdicionCategoria,
          as: "edicionesCategoria",
          required: true,
          where: {
            ...(estado && estado !== "TODOS" && { estado }),
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
      distinct: true,
      col: "id_categoria",
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Categoria.findAndCountAll(queryOptions);

    if (count === 0) {
      return res.status(404).json({
        message: "Esta edición aún no tiene categorías definidas",
        pagination: {
          total: count,
          page: page ? parseInt(page) : 1,
          totalPages: limit ? Math.ceil(count / limit) : 1,
          limit: limit ? parseInt(limit) : count,
        },
      });
    }

    return res.json({
      message: "Categorías obtenidas correctamente",
      categorias: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error("Error al listar categorías por edición:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerCategoria = async (req, res) => {
  try {
    const { id_edicion_categoria } = req.params;

    const categoria = await Categoria.findOne({
      include: [
        {
          model: EdicionCategoria,
          as: "edicionesCategoria",
          where: { id_edicion_categoria },
        },
      ],
      distinct: true,
    });

    res.status(200).json({
      message: "Categoría obtenida correctamente",
      categoria,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      include: [
        {
          model: EdicionCategoria,
          as: "edicionesCategoria",
          required: true,
        },
      ],
      distinct: true,
    });

    return res.json(categorias);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const agregarCategoria = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { nombre_categoria } = req.body;

    const existe = await Categoria.findOne({
      where: { nombre_categoria: nombre_categoria },
      transaction,
    });

    if (!!existe) {
      await transaction.rollback();
      return res.status(200).json({
        categoria: existe,
      });
    }

    const categoria = await Categoria.create(
      {
        nombre_categoria: nombre_categoria,
      },
      { transaction },
    );

    await transaction.commit();

    res.status(201).json({
      message: "Categoria creada correctamente",
      categoria: categoria,
    });
  } catch (error) {
    await transaction.rollback();
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const agregarCategoriaEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_categoria, descripcion, numero_ganadores } = req.body;
    const { id_edicion } = req.params;

    const categoria = await Categoria.findByPk(id_categoria, { transaction });

    if (!categoria) {
      await transaction.rollback();
      return res.status(404).json({ message: "Categoria no encontrada" });
    }

    const existe = await EdicionCategoria.findOne({
      where: {
        id_categoria: categoria.id_categoria,
        id_edicion: id_edicion,
      },
      transaction,
    });

    if (existe) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Esta categoría ya está registrada en esta edición",
      });
    }

    const existe_descripcion = await EdicionCategoria.findOne({
      where: { id_edicion: id_edicion, descripcion },
      transaction,
    });

    if (existe_descripcion) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Ya existe una categoría con esa descripción en esta edición.",
      });
    }

    const categoria_nueva = await EdicionCategoria.create(
      {
        id_categoria: categoria.id_categoria,
        id_edicion: id_edicion,
        descripcion: descripcion,
        numero_ganadores: numero_ganadores,
        fecha_registro: new Date(),
        estado: "activo",
      },
      { transaction },
    );

    const response = await Categoria.findByPk(categoria.id_categoria, {
      include: [
        {
          model: EdicionCategoria,
          as: "edicionesCategoria",
          required: true,
        },
      ],
      transaction,
    });

    await transaction.commit();

    res.status(201).json({
      message: "Categoria agregada correctamente",
      categoria: response,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const editarCategoriaEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_edicion_categoria } = req.params;
    const { descripcion, numero_ganadores } = req.body;

    const existe = await EdicionCategoria.findOne({
      where: { id_edicion_categoria: id_edicion_categoria },
      transaction,
    });

    if (!existe) {
      await transaction.rollback();
      return res.status(404).json({ message: "Categoria no encontrada" });
    }

    await EdicionCategoria.update(
      {
        numero_ganadores,
        descripcion,
        fecha_actualizacion: new Date(),
      },
      {
        where: { id_edicion_categoria: id_edicion_categoria },
        transaction,
      },
    );

    const response = await Categoria.findByPk(existe.id_categoria, {
      include: [
        {
          model: EdicionCategoria,
          as: "edicionesCategoria",
          required: true,
        },
      ],
      transaction,
    });

    await transaction.commit();

    res.status(201).json({
      message: "Categoria editada correctamente",
      categoria: response,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const eliminarCategoriaEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_edicion_categoria } = req.params;

    const categoria = await EdicionCategoria.findByPk(id_edicion_categoria);

    if (!categoria) {
      await transaction.rollback();
      return res.status(404).json({ message: "Categoria no encontrada" });
    }

    await EdicionCategoria.destroy({
      where: { id_edicion_categoria: categoria.id_edicion_categoria },
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      message: "Categoria eliminada correctamente",
      id_edicion_categoria,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const cambiarEstado = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_edicion_categoria } = req.params;
    const { estado, observacion } = req.body;

    const categoria = await EdicionCategoria.findByPk(id_edicion_categoria, {
      include: [
        {
          model: Participacion,
          as: "participaciones",
          required: false,
          include: [
            {
              model: Usuario,
              as: "usuario",
            },
          ],
        },
        {
          model: Categoria,
          as: "categoria",
        },
        {
          model: Edicion,
          as: "edicion",
        },
      ],
      transaction,
    });

    if (!categoria) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Categoría no encontrada",
      });
    }

    const has_participaciones_evaluadas = categoria.participaciones.some(
      (participacion) => participacion.estado === "evaluada",
    );

    if (has_participaciones_evaluadas) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "No se puede cambiar el estado de la categoría. Hay participaciones evaluadas.",
      });
    }

    if (estado === "inactivo") {
      const observacionRechazo = `La participación es rechazada debido a que la categoría fue inactivada. Motivo: ${observacion}`;

      for (const participacion of categoria.participaciones) {
        participacion.estado = "rechazada";
        participacion.observacion = observacionRechazo;
        participacion.fecha_revision = new Date();

        await participacion.save({
          transaction,
        });

        if (participacion.usuario) {
          const notificacion = await NotificacionService.crear({
            tipo: "PARTICIPACION_RECHAZADA",
            titulo: "Postulación rechazada",
            mensaje: `
              <p>Hola <b>${participacion.usuario.primer_nombre}</b>,</p>

              <p>
                Te informamos que tu postulación en la edición
                <b>${categoria.edicion.nombre_edicion}</b>
                ha sido <b>rechazada</b>.
              </p>

              <p>
                <b>Categoría:</b>
                ${categoria.categoria.nombre_categoria}
              </p>

              <p>
                <b>Motivo:</b>
                La categoría fue inactivada durante el proceso de la convocatoria.
              </p>

              <p>
                Por este motivo, tu participación no podrá continuar
                en el proceso de evaluación.
              </p>

              <p>
                Para más información, puedes consultar el estado de tu
                postulación en la plataforma.
              </p>
            `,
            prioridad: "alta",
            id_usuario: participacion.usuario.id_usuario,
            id_rol: 4,
            datos: {
              id_edicion: categoria.edicion.id_edicion,
              nombre_edicion: categoria.edicion.nombre_edicion,
              id_categoria: categoria.categoria.id_categoria,
              nombre_categoria: categoria.categoria.nombre_categoria,
              estado_postulacion: "Rechazada",
              motivo:
                "Categoría inactivada durante el proceso de la convocatoria",
            },
          });

          await NotificacionService.procesar(
            notificacion,
            ["sistema"],
            participacion.usuario,
          );
        }
      }
    }

    await EdicionCategoria.update(
      {
        estado,
        observacion_inactivacion: estado === "inactiva" ? observacion : null,
        fecha_actualizacion: new Date(),
      },
      {
        where: {
          id_edicion_categoria,
        },
        transaction,
      },
    );

    const response = await Categoria.findByPk(categoria.id_categoria, {
      include: [
        {
          model: EdicionCategoria,
          as: "edicionesCategoria",
          required: true,
        },
      ],
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      message: "Categoría actualizada correctamente",
      categoria: response,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Error al cambiar estado de la categoría:", error);

    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

module.exports = {
  listarCategorias,
  obtenerCategoria,
  agregarCategoria,
  agregarCategoriaEdicion,
  editarCategoriaEdicion,
  cambiarEstado,
  eliminarCategoriaEdicion,
  listarCategoriasPorEdicion,
};

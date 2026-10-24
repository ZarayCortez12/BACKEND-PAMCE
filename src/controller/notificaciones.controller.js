const { Op} = require("sequelize");
const { Usuario, Notificacion } = require("../models");
const dayjs = require("dayjs");

const listarNotificacionesSinLeer = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { id_rol } = req.query;

    const notificaciones = await Notificacion.findAll({
      where: {
        id_usuario: id_usuario,
        id_rol: id_rol,
        leida: false,
      },
      distinct: true,
    });

    return res.json({
      notificaciones,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarNotificaciones = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const {
      rol,
      prioridad,
      leida,
      fecha_inicio,
      fecha_fin,
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (page - 1) * limit;

    const whereNotification = {
      ...(rol && {
        id_rol: rol,
      }),
      ...(id_usuario && {
        id_usuario: id_usuario,
      }),
      ...(prioridad &&
        prioridad !== "TODOS" && {
          prioridad,
        }),
      ...(leida &&
        leida !== "TODOS" && {
          leida,
        }),
    };

    if (fecha_inicio || fecha_fin) {
      const rangoFecha = {};

      if (fecha_inicio) {
        rangoFecha[Op.gte] = dayjs(fecha_inicio).startOf("day").toDate();
      }

      if (fecha_fin) {
        rangoFecha[Op.lte] = dayjs(fecha_fin).endOf("day").toDate();
      }

      whereNotification[Op.or] = [
        { fecha_envio: rangoFecha },
        { fecha_leida: rangoFecha },
      ];
    }

    const { count, rows } = await Notificacion.findAndCountAll({
      where: whereNotification,
      order: [["fecha_envio", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    return res.json({
      message: "Notificaciones obtenidas correctamente",
      notificaciones: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const marcarNotificacionLeida = async (req, res) => {
  try {
    const { id_notificacion } = req.params;

    const notificacion = await Notificacion.findOne({
      where: { id: id_notificacion },
    });

    if (!notificacion) {
      return res.status(404).json({ message: "Notificación no encontrada" });
    }

    await notificacion.update({ leida: true, fecha_leida: new Date() });

    return res
      .status(200)
      .json({ message: "Notificación marcada como leída", notificacion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

module.exports = {
  listarNotificacionesSinLeer,
  listarNotificaciones,
  marcarNotificacionLeida,
};

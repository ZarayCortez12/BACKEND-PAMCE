const { Notificacion } = require("../models");
const dayjs = require("dayjs");
const { sendEmailNotification } = require("../configs/mail.config.js");

class NotificacionService {
  async crear(data) {
    return await Notificacion.create({
      ...data,
      estado: "pendiente",
      fecha_creacion: new Date(),
    });
  }

  async procesar(notificacion, canales, usuario, mensaje) {
    try {
      if (canales.includes("email")) {
        await sendEmailNotification(usuario.correo_electronico, mensaje);

        await notificacion.update({
          estado: "enviada",
          fecha_envio: new Date(),
        });
      }

      if (canales.includes("sistema")) {
        await notificacion.update({
          estado: "enviada",
          fecha_envio: new Date(),
        });
      }
    } catch (error) {
      await notificacion.update({
        estado: "fallida",
      });

      console.error(error);
    }
  }
}

module.exports = new NotificacionService();

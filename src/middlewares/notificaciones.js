const { Notificacion } = require("../models");
const dayjs = require("dayjs");
const { sendEmailNotification } = require("../configs/mail.config.js");
const { sanitizarHtml } = require("../utils/sanitizarHtml");

class NotificacionService {
  async crear(data) {
    return await Notificacion.create({
      ...data,
      // El mensaje se muestra como HTML en el frontend: se limpia aquí para
      // que los datos escritos por usuarios (nombres, etc.) no ejecuten código
      mensaje: sanitizarHtml(data.mensaje),
      estado: "pendiente",
      fecha_creacion: new Date(),
    });
  }

  async procesar(notificacion, canales, usuario, mensaje) {
    try {
      if (canales.includes("email")) {
        // sendEmailNotification no lanza error: devuelve false si el envío falla
        const enviado = await sendEmailNotification(
          usuario.correo_electronico,
          mensaje,
        );

        if (!enviado) {
          throw new Error(
            `No se pudo enviar el correo de la notificación ${notificacion.id}`,
          );
        }

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

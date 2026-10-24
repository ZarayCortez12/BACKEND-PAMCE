const cron = require("node-cron");
const { Op } = require("sequelize");
const CodigoRecuperacion = require("../models/codigoRecuperacionModel");

function limpiarOTP() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const deleted = await CodigoRecuperacion.destroy({
          where: {
            fecha_expiracion: {
              [Op.lt]: new Date(),
            },
          },
        });
      } catch (error) {
        console.error("Error al limpiar códigos expirados:", error);
      }
    },
    {
      scheduled: true,
      recoverMissedExecutions: true,
      timezone: "America/Bogota",
    },
  );
}

module.exports = { limpiarOTP };

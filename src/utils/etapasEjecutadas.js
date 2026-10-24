const { Notificacion } = require("../models");

// Los crons de inicio de etapa envían una notificación (INICIO_ETAPA_*) al
// terminar. Esa notificación sirve como marca de "ya se ejecutó" para que el
// cron pueda correr todos los días de la etapa (y ponerse al día si el
// servidor estuvo apagado) sin repetir el trabajo. Se compara también la
// fecha de inicio: si se cambian las fechas de la edición, vuelve a correr.
const etapaYaEjecutada = async ({ tipo, edicion, campoFecha }) => {
  const notificacion = await Notificacion.findOne({
    where: {
      tipo,
      datos: {
        edicion_id: edicion.id_edicion,
        [campoFecha]: String(edicion[campoFecha]),
      },
    },
  });

  return Boolean(notificacion);
};

module.exports = { etapaYaEjecutada };

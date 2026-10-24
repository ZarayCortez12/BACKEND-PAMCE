const { ParticipacionRequisito } = require("../models");

const buscarRespuestaParticipacion = async (req, res, next) => {
  try {
    const { id_participacion_requisito } = req.params;

    const respuesta = await ParticipacionRequisito.findByPk(
      id_participacion_requisito,
    );

    if (!respuesta) {
      return res.status(404).json({
        message: "La respuesta no existe.",
      });
    }

    req.respuestaParticipacion = respuesta;

    next();
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error al obtener la respuesta.",
    });
  }
};

module.exports = buscarRespuestaParticipacion;

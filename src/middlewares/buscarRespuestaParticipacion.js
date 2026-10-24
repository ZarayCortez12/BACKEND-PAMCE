const {
  ParticipacionRequisito,
  Participacion,
  Edicion,
} = require("../models");
const { hoyBogota } = require("../utils/fechas");

// Se ejecuta antes de multer: si la respuesta no se puede editar, el
// archivo nuevo nunca se escribe y el documento anterior queda intacto.
const buscarRespuestaParticipacion = async (req, res, next) => {
  try {
    const { id_participacion_requisito } = req.params;

    const respuesta = await ParticipacionRequisito.findByPk(
      id_participacion_requisito,
      {
        include: [
          {
            model: Participacion,
            as: "participacion",
            include: [{ model: Edicion, as: "edicion" }],
          },
        ],
      },
    );

    if (!respuesta) {
      return res.status(404).json({
        message: "La respuesta no existe.",
      });
    }

    const participacion = respuesta.participacion;

    if (participacion?.id_usuario !== req.user.data.id_usuario) {
      return res.status(403).json({
        message: "Esta respuesta no pertenece a tu participación.",
      });
    }

    if (participacion.estado !== "pendiente") {
      return res.status(400).json({
        message:
          "Solo puedes editar tus requisitos mientras la postulación esté pendiente.",
      });
    }

    const edicion = participacion.edicion;
    const hoy = hoyBogota();

    if (
      !edicion ||
      edicion.estado_edicion !== "en_proceso" ||
      hoy < String(edicion.fecha_inicio_convocatoria) ||
      hoy > String(edicion.fecha_fin_convocatoria)
    ) {
      return res.status(400).json({
        message:
          "Solo puedes editar tus requisitos durante la etapa de convocatoria.",
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

const jwt = require("jsonwebtoken");
const { Edicion } = require("../models");

const validarAccesoConvocatoria = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "El formato del token no es válido.",
      });
    }

    const token = authHeader ? authHeader.split(" ")[1] : null;
    
    const idEdicionSolicitada =
      req.params.id_edicion ?? req.query.id_edicion ?? req.body?.id_edicion;

    if (!idEdicionSolicitada) {
      return res.status(400).json({
        message: "No se proporcionó la edición de la convocatoria.",
      });
    }

    let payload = null;
    let modo = "publica";

    if (token) {
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(401).json({
          message: "El token de invitación no es válido o ha expirado.",
        });
      }

      if (!payload.id_edicion) {
        return res.status(403).json({
          message: "El token no está asociado a una edición.",
        });
      }

      if (Number(payload.id_edicion) !== Number(idEdicionSolicitada)) {
        return res.status(403).json({
          message: "El token no corresponde a esta edición.",
        });
      }

      modo = "invitacion";
    }

    const edicion = await Edicion.findByPk(idEdicionSolicitada);

    if (!edicion) {
      return res.status(404).json({
        message: "La edición no existe.",
      });
    }

    if (edicion.estado_edicion !== "en_proceso") {
      return res.status(403).json({
        message: "Esta edición no está disponible para inscripciones.",
      });
    }

    const fechaActual = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Bogota",
    });

    const fechaInicio = String(edicion.fecha_inicio_convocatoria).slice(0, 10);

    const fechaFin = String(edicion.fecha_fin_convocatoria).slice(0, 10);

    if (
      !edicion.fecha_inicio_convocatoria ||
      !edicion.fecha_fin_convocatoria ||
      fechaActual < fechaInicio ||
      fechaActual > fechaFin
    ) {
      return res.status(403).json({
        message: "La convocatoria no está abierta actualmente.",
      });
    }

    req.accesoConvocatoria = {
      id_edicion: edicion.id_edicion,
      modo,
      payload,
    };

    next();
  } catch (error) {
    console.error("Error al validar el acceso a la convocatoria:", error);

    return res.status(500).json({
      message: "Error al validar el acceso a la convocatoria.",
    });
  }
};

module.exports = validarAccesoConvocatoria;

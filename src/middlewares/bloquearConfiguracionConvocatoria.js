const {
  Edicion,
  EdicionCategoria,
  RequisitosEdicion,
  RequisitosEdicionCategoria,
  EdicionCategoriaRubrica,
  EdicionCategoriaRubricaCriterio,
} = require("../models");
const { hoyBogota } = require("../utils/fechas");

// Obtiene el id de la edición a partir del parámetro que use cada ruta
const RESOLVERES = {
  id_edicion: async (id) => id,
  id_edicion_categoria: async (id) =>
    (await EdicionCategoria.findByPk(id))?.id_edicion,
  id_requisito_edicion: async (id) =>
    (await RequisitosEdicion.findByPk(id))?.id_edicion,
  idEdicionRequisito: async (id) =>
    (await RequisitosEdicion.findByPk(id))?.id_edicion,
  id_requisito_edicion_categoria: async (id) => {
    const requisito = await RequisitosEdicionCategoria.findByPk(id);
    return requisito && RESOLVERES.id_edicion_categoria(requisito.id_edicion_categoria);
  },
  id_ecr: async (id) => {
    const ecr = await EdicionCategoriaRubrica.findByPk(id);
    return ecr && RESOLVERES.id_edicion_categoria(ecr.id_edicion_categoria);
  },
  id_ecrc: async (id) => {
    const ecrc = await EdicionCategoriaRubricaCriterio.findByPk(id);
    return ecrc && RESOLVERES.id_edicion_categoria(ecrc.id_edicion_categoria);
  },
};

// Desde el inicio de la convocatoria, los requisitos y rúbricas de la edición
// quedan bloqueados (así lo anuncia el sistema al director), para garantizar
// igualdad de condiciones entre todos los participantes.
const bloquearConfiguracionConvocatoria = async (req, res, next) => {
  try {
    const parametro = Object.keys(RESOLVERES).find(
      (nombre) => req.params[nombre] !== undefined,
    );

    if (!parametro) {
      return next();
    }

    const idEdicion = await RESOLVERES[parametro](req.params[parametro]);
    const edicion = idEdicion ? await Edicion.findByPk(idEdicion) : null;

    // Si no existe, el controlador responde el 404 correspondiente
    if (!edicion) {
      return next();
    }

    if (
      edicion.fecha_inicio_convocatoria &&
      hoyBogota() >= String(edicion.fecha_inicio_convocatoria)
    ) {
      return res.status(400).json({
        message:
          "La convocatoria de esta edición ya inició: los requisitos y rúbricas están bloqueados y no se pueden modificar.",
      });
    }

    next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al validar la etapa de la edición.",
    });
  }
};

module.exports = { bloquearConfiguracionConvocatoria };

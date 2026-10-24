const express = require("express");
const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");
const { bloquearConfiguracionConvocatoria } = require("../middlewares/bloquearConfiguracionConvocatoria");
const {
  listarRequisitosPorCategoriaEdicion,
  obtenerConfiguracionRequisitoDeCategoriaEdicion,
  crearRequisito,
  agregarRequisitoCategoriaEdicion,
  editarConfiguracionRequisitoCategoriaEdicion,
  listarRequisitosEdicion,
  listarRequisitosEdicionInscripcion,
  listarRequisitosCategoriaEdicionInscripcion,
  filtrarRequisitosEdicion,
  filtrarRequisitosCategoriaEdicion,
  agregarRequisitoEdicion,
  editarRequisito,
  editarRequisitoCategoriaEdicion,
  editarRequisitoEdicion,
  editarConfiguracionRequisitoEdicion,
  eliminarRequisito,
  eliminarRequisitoCategoriaEdicion,
  eliminarRequisitoEdicion,
} = require("../controller/requisitos.controller");

const router = express.Router();

router.get(
  "/requisitos/categoria/:id_edicion_categoria",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarRequisitosPorCategoriaEdicion,
);
router.get(
  "/requisitos/configuracion/:id_requisito_edicion_categoria",
  verificarToken,
  verificarRol("director", "jurado", "participante"),
  obtenerConfiguracionRequisitoDeCategoriaEdicion,
);
router.post(
  "/requisitos",
  verificarToken,
  verificarRol("director"),
  crearRequisito,
);
router.post(
  "/requisitos/edicion/categoria/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  agregarRequisitoCategoriaEdicion,
);
router.put(
  "/requisitos/edicion/categoria/:id_requisito_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  editarRequisitoCategoriaEdicion,
);
router.put(
  "/requisitos/edicion/categoria/configuracion/:id_requisito_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  editarConfiguracionRequisitoCategoriaEdicion,
);
router.delete(
  "/requisitos/edicion/categoria/:id_requisito_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  eliminarRequisitoCategoriaEdicion,
);
router.get(
  "/requisitos/edicion/:id_edicion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarRequisitosEdicion,
);
router.post(
  "/requisitos/edicion/:id_edicion",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  agregarRequisitoEdicion,
);
router.put(
  "/requisitos/edicion/:id_requisito_edicion",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  editarRequisitoEdicion,
);
router.put(
  "/requisitos/edicion/configuracion/:id_requisito_edicion",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  editarConfiguracionRequisitoEdicion,
);
router.delete(
  "/requisitos/edicion/:id_requisito_edicion",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  eliminarRequisitoEdicion,
);

router.get(
  "/requisitos/filtrar/:idEdicion",
  verificarToken,
  verificarRol("director"),
  filtrarRequisitosEdicion,
);
router.put("/requisitos/:idEdicionRequisito", verificarToken, verificarRol("director"), bloquearConfiguracionConvocatoria, editarRequisito);
router.delete(
  "/requisitos/:idEdicionRequisito",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  eliminarRequisito,
);

router.get(
  "/requisitos/categoria/filtrar/:idEdicionCategoria",
  verificarToken,
  verificarRol("director"),
  filtrarRequisitosCategoriaEdicion,
);

router.get(
  "/requisitos/inscripcion/:idEdicion",
  listarRequisitosEdicionInscripcion,
);
router.get(
  "/requisitos/categoria/inscripcion/:idEdicionCategoria",
  listarRequisitosCategoriaEdicionInscripcion,
);

module.exports = router;

const express = require("express");
const {
  obtenerEdicionEnProcesoPublico,
  obtenerEdicionEnProcesoFanPage,
  obtenerEdicionesFanPage,
  obtenerUsuarioPorCedulaPublico,
  listarRequisitosEdicionPublico,
  listarCategoriasPorEdicionPublico,
  listarRequisitosCategoriaEdicionPublico,
  agregarParticipantePublico,
  registrarParticipacionPublico,
  agregaUsuarioPublico,
} = require("../controller/publicos.controller");
const validarAccesoConvocatoria = require("../middlewares/validarAccesoConvocatoria.js");
const upload = require("../middlewares/multer");
const router = express.Router();

router.get(
  "/ediciones/estado/en-proceso/:token",
  obtenerEdicionEnProcesoPublico,
);
router.get("/ediciones/publica/en-proceso", obtenerEdicionEnProcesoFanPage);
router.get("/ediciones", obtenerEdicionesFanPage);
router.get(
  "/usuarios/:numero_documento",
  validarAccesoConvocatoria,
  obtenerUsuarioPorCedulaPublico,
);
router.get(
  "/requisitos/edicion/:id_edicion",
  validarAccesoConvocatoria,
  listarRequisitosEdicionPublico,
);
router.get(
  "/categorias/edicion/:id_edicion",
  validarAccesoConvocatoria,
  listarCategoriasPorEdicionPublico,
);
router.get(
  "/requisitos/categoria/:id_edicion_categoria",
  validarAccesoConvocatoria,
  listarRequisitosCategoriaEdicionPublico,
);
router.post(
  "/participantes",
  validarAccesoConvocatoria,
  agregarParticipantePublico,
);
router.post(
  "/crear-participacion",
  validarAccesoConvocatoria,
  upload.any(),
  registrarParticipacionPublico,
);
router.post("/usuarios", agregaUsuarioPublico);

module.exports = router;

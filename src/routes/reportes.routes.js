const express = require("express");
const {
  reportesParticipaciones,
  reportesPostulaciones,
  reportesConvocatorias,
  reportesUsuarios,
  reportesParticipacionesPDF,
  reportesParticipacionesExcel,
  reportesPostulacionesPDF,
  reportesPostulacionesExcel,
  reportesConvocatoriasPDF,
  reportesConvocatoriasExcel,
  reportesUsuariosPDF,
  reportesUsuariosExcel,
} = require("../controller/reportes.controller");
const upload = require("../middlewares/multer");
const { verificarToken } = require("../utils/verificarToken");

const router = express.Router();

router.get(
  "/reportes/participaciones",
  verificarToken,
  reportesParticipaciones,
);
router.get("/reportes/postulaciones", verificarToken, reportesPostulaciones);
router.get("/reportes/convocatorias", verificarToken, reportesConvocatorias);
router.get("/reportes/usuarios", verificarToken, reportesUsuarios);
router.get(
  "/reportes/participaciones/pdf",
  verificarToken,
  reportesParticipacionesPDF,
);
router.get(
  "/reportes/participaciones/excel",
  verificarToken,
  reportesParticipacionesExcel,
);
router.get(
  "/reportes/postulaciones/pdf",
  verificarToken,
  reportesPostulacionesPDF,
);
router.get(
  "/reportes/postulaciones/excel",
  verificarToken,
  reportesPostulacionesExcel,
);
router.get(
  "/reportes/convocatorias/pdf",
  verificarToken,
  reportesConvocatoriasPDF,
);
router.get(
  "/reportes/convocatorias/excel",
  verificarToken,
  reportesConvocatoriasExcel,
);
router.get("/reportes/usuarios/pdf", verificarToken, reportesUsuariosPDF);
router.get("/reportes/usuarios/excel", verificarToken, reportesUsuariosExcel);

module.exports = router;

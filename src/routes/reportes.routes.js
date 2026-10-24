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
const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");

const router = express.Router();

router.get(
  "/reportes/participaciones",
  verificarToken,
  verificarRol("director"),
  reportesParticipaciones,
);
router.get("/reportes/postulaciones", verificarToken, verificarRol("director"), reportesPostulaciones);
router.get("/reportes/convocatorias", verificarToken, verificarRol("director"), reportesConvocatorias);
router.get("/reportes/usuarios", verificarToken, verificarRol("director"), reportesUsuarios);
router.get(
  "/reportes/participaciones/pdf",
  verificarToken,
  verificarRol("director"),
  reportesParticipacionesPDF,
);
router.get(
  "/reportes/participaciones/excel",
  verificarToken,
  verificarRol("director"),
  reportesParticipacionesExcel,
);
router.get(
  "/reportes/postulaciones/pdf",
  verificarToken,
  verificarRol("director"),
  reportesPostulacionesPDF,
);
router.get(
  "/reportes/postulaciones/excel",
  verificarToken,
  verificarRol("director"),
  reportesPostulacionesExcel,
);
router.get(
  "/reportes/convocatorias/pdf",
  verificarToken,
  verificarRol("director"),
  reportesConvocatoriasPDF,
);
router.get(
  "/reportes/convocatorias/excel",
  verificarToken,
  verificarRol("director"),
  reportesConvocatoriasExcel,
);
router.get("/reportes/usuarios/pdf", verificarToken, verificarRol("director"), reportesUsuariosPDF);
router.get("/reportes/usuarios/excel", verificarToken, verificarRol("director"), reportesUsuariosExcel);

module.exports = router;

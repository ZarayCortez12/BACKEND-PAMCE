const express = require("express");
const { validarSchema } = require("../middlewares/validarSchema");
const { actualizarDatos } = require("../schemas/autenticacion");
const {
  listarRegistrosAuditoria,
  obtenerRegistroAuditoria,
} = require("../controller/auditoria.controller");
const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");

const router = express.Router();

router.get("/auditoria", verificarToken, verificarRol("administrador"), listarRegistrosAuditoria);
router.get("/auditoria/:id_registro", verificarToken, verificarRol("administrador"), obtenerRegistroAuditoria);

module.exports = router;

const express = require("express");
const { validarSchema } = require("../middlewares/validarSchema");
const { actualizarDatos } = require("../schemas/autenticacion");
const {
  listarRegistrosAuditoria,
  obtenerRegistroAuditoria,
} = require("../controller/auditoria.controller");
const { verificarToken } = require("../utils/verificarToken");

const router = express.Router();

router.get("/auditoria", verificarToken, listarRegistrosAuditoria);
router.get("/auditoria/:id_registro", verificarToken, obtenerRegistroAuditoria);

module.exports = router;

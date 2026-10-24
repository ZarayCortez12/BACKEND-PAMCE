const express = require("express");

const {
  login,
  sendCodigo,
  validarCodigoOTP,
  reestablecerContraseña,
  loginGoogle,
  obtenerUsuarioActual,
  refreshAccessToken,
  enviarCorreosConvocatoria,
  logout,
  crearContrasena,
  reenviarTokenCrearContrasena,
} = require("../controller/autenticacion.controller");

const { getTokenData } = require("../configs/jwt.config");
const { authMiddleware } = require("../configs/jwt.config");
const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");

const router = express.Router();
router.post("/", login);
router.post("/enviar-codigo", sendCodigo);
router.post("/validar-codigo", validarCodigoOTP);
router.post("/reestablecer-contrasena", reestablecerContraseña);
router.post("/login-google", loginGoogle);
router.get("/usuario-actual", verificarToken, obtenerUsuarioActual);
router.post("/refresh-token", refreshAccessToken);
router.post(
  "/enviar-correos-convocatoria",
  verificarToken,
  verificarRol("director"),
  enviarCorreosConvocatoria,
);
router.post("/logout", verificarToken, logout);
router.post("/crear-contrasena", crearContrasena);
router.post("/reenviar-token-crear-contrasena", reenviarTokenCrearContrasena);

module.exports = router;

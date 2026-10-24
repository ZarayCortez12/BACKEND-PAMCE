const { rateLimit } = require("express-rate-limit");

const mensaje = (texto) => ({ message: texto });

// Por correo (y por IP si no viene): así no se puede adivinar el código de
// recuperación de una cuenta probando desde muchas direcciones
const porCorreo = (req) =>
  String(req.body?.correo_electronico || "").toLowerCase().trim() ||
  req.ip;

// El código dura 3 minutos: con 5 intentos es imposible adivinarlo
const limiteValidarCodigo = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  keyGenerator: porCorreo,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: mensaje(
    "Demasiados intentos de validar el código. Solicita uno nuevo en 10 minutos.",
  ),
});

const limiteEnviarCodigo = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: porCorreo,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: mensaje(
    "Has solicitado demasiados códigos. Intenta de nuevo en 15 minutos.",
  ),
});

// Complementa el bloqueo de cuenta por intentos fallidos con un límite por IP
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: mensaje(
    "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.",
  ),
});

module.exports = { limiteValidarCodigo, limiteEnviarCodigo, limiteLogin };

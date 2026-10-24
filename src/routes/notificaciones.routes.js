const express = require("express");
const {
  listarNotificacionesSinLeer,
  listarNotificaciones,
  marcarNotificacionLeida,
} = require("../controller/notificaciones.controller");
const { verificarToken } = require("../utils/verificarToken");

const router = express.Router();

router.get(
  "/notificaciones/sin-leer/:id_usuario",
  verificarToken,
  listarNotificacionesSinLeer,
);
router.get("/notificaciones/:id_usuario", verificarToken, listarNotificaciones);
router.put(
  "/notificaciones/:id_notificacion",
  verificarToken,
  marcarNotificacionLeida,
);

module.exports = router;

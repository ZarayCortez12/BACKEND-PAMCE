const express = require("express");
const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");
const {
  listarEdiciones,
  obtenerEdicion,
  agregarEdicion,
  editarEdicion,
  cambiarEstado,
  eliminarEdicion,
  obtenerEdicionEnProceso,
  obtenerInformacionEdicion,
} = require("../controller/edicion.controller");

const router = express.Router();

router.get(
  "/ediciones",
  verificarToken,
  verificarRol("administrador", "director", "jurado"),
  listarEdiciones,
);
router.post(
  "/ediciones",
  verificarToken,
  verificarRol("director"),
  agregarEdicion,
);
router.get(
  "/ediciones/:idEdicion",
  verificarToken,
  verificarRol("director", "jurado", "participante"),
  obtenerEdicion,
);
router.put(
  "/ediciones/:idEdicion",
  verificarToken,
  verificarRol("director"),
  editarEdicion,
);
router.put(
  "/ediciones/estado/:idEdicion",
  verificarToken,
  verificarRol("director"),
  cambiarEstado,
);
router.delete(
  "/ediciones/:idEdicion",
  verificarToken,
  verificarRol("director"),
  eliminarEdicion,
);
router.get(
  "/ediciones/estado/en-proceso",
  verificarToken,
  verificarRol("director", "jurado", "participante"),
  obtenerEdicionEnProceso,
);
router.get(
  "/ediciones/:id_edicion",
  verificarToken,
  verificarRol("director"),
  obtenerInformacionEdicion,
);

module.exports = router;

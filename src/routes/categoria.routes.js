const express = require("express");
const {
  listarCategoriasPorEdicion,
  obtenerCategoria,
  listarCategorias,
  agregarCategoria,
  agregarCategoriaEdicion,
  editarCategoriaEdicion,
  cambiarEstado,
  eliminarCategoriaEdicion,
} = require("../controller/categoria.controller");

const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");

const router = express.Router();

router.get(
  "/categorias/edicion/:id_edicion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarCategoriasPorEdicion,
);
router.get(
  "/categorias/:id_edicion_categoria",
  verificarToken,
  verificarRol("director", "jurado", "participante"),
  obtenerCategoria,
);
router.get("/categorias", verificarToken, listarCategorias);
router.post(
  "/categorias",
  verificarToken,
  verificarRol("director"),
  agregarCategoria,
);
router.post(
  "/categorias/:id_edicion",
  verificarToken,
  verificarRol("director"),
  agregarCategoriaEdicion,
);
router.put(
  "/categorias/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  editarCategoriaEdicion,
);
router.delete(
  "/categorias/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  eliminarCategoriaEdicion,
);
router.put(
  "/categorias/estado/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  cambiarEstado,
);

module.exports = router;

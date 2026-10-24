const express = require("express");
const {
  listarCriteriosPorRubricaPorCategoriaEdicion,
  crearCriterio,
  agregarPorcentajesCriterio,
  editarPorcentajeCriterio,
} = require("../controller/criterios.controller");

const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");

const router = express.Router();

router.get(
  "/criterios/:id_rubrica/:id_edicion_categoria",
  verificarToken,
  verificarRol("director", "jurado", "participante"),
  listarCriteriosPorRubricaPorCategoriaEdicion,
);
router.post("/criterios", verificarToken, verificarRol("director"), crearCriterio);
router.post(
  "/criterios/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  agregarPorcentajesCriterio,
);
router.put(
  "/criterios/porcentaje/:id_ecrc",
  verificarToken,
  verificarRol("director"),
  editarPorcentajeCriterio,
);

module.exports = router;

const express = require("express");
const {
  listarCriteriosPorRubricaPorCategoriaEdicion,
  crearCriterio,
  agregarPorcentajesCriterio,
  editarPorcentajeCriterio,
} = require("../controller/criterios.controller");

const { verificarToken } = require("../utils/verificarToken");

const router = express.Router();

router.get(
  "/criterios/:id_rubrica/:id_edicion_categoria",
  verificarToken,
  listarCriteriosPorRubricaPorCategoriaEdicion,
);
router.post("/criterios", verificarToken, crearCriterio);
router.post(
  "/criterios/:id_edicion_categoria",
  verificarToken,
  agregarPorcentajesCriterio,
);
router.put(
  "/criterios/porcentaje/:id_ecrc",
  verificarToken,
  editarPorcentajeCriterio,
);

module.exports = router;

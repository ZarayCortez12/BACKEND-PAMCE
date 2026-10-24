const express = require("express");
const {
  listarRubricasPorCategoriaEdicion,
  crearRubrica,
  crearRubricaCriterio,
  agregarRubricaAEdicionCategoria,
  listarRubricas,
  obtenerRubricaCriterios,
  editarPorcentajeRubrica,
  eliminarRubricaDeEdicionCategoria,
} = require("../controller/rubricas.controller");

const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");
const { bloquearConfiguracionConvocatoria } = require("../middlewares/bloquearConfiguracionConvocatoria");

const router = express.Router();

router.get("/rubricas", verificarToken, verificarRol("director"), listarRubricas);
router.get(
  "/rubricas/:id_edicion_categoria",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarRubricasPorCategoriaEdicion,
);
router.get(
  "/rubricas/:id_rubrica/criterios",
  verificarToken,
  verificarRol("director"),
  obtenerRubricaCriterios,
);
router.post("/rubricas", verificarToken, verificarRol("director"), crearRubrica);
router.post("/rubricas/criterios", verificarToken, verificarRol("director"), crearRubricaCriterio);
router.post(
  "/rubricas/edicion/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  agregarRubricaAEdicionCategoria,
);
router.put(
  "/rubricas/porcentaje/:id_ecr",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  editarPorcentajeRubrica,
);
router.delete(
  "/rubricas/edicion/:id_ecr",
  verificarToken,
  verificarRol("director"),
  bloquearConfiguracionConvocatoria,
  eliminarRubricaDeEdicionCategoria,
);

module.exports = router;

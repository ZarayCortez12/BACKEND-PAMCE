const express = require("express");
const {
  listarRubricasConCriterios,
  editarPorcentajeCriterio,
  listarRubricasFiltradasCategoria,
  agregarRubricaAEdicionCategoria,
  agregarPorcentajesCriterio,
  editarPorcentajeRubrica,
  eliminarRubricaDeEdicionCategoria,
  crearRubrica,
  crearCriterio,
  crearRubricaCriterio,
  obtenerRubricaCriterios,
  obtenerEvaluaciones,
} = require("../controller/evaluacion.controller");
const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");

const router = express.Router();

router.get(
  "/rubricas/listar-rubricas",
  verificarToken,
  listarRubricasConCriterios,
);
router.post("/rubricas/crear", verificarToken, crearRubrica);
router.post("/criterios/crear", verificarToken, crearCriterio);
router.post("/rubricas/criterio", verificarToken, crearRubricaCriterio);
router.put(
  "/rubricas/editar-porcentaje/:id_ecrc",
  verificarToken,
  editarPorcentajeCriterio,
);
router.get(
  "/rubricas/filtradas/:id_edicion_categoria",
  verificarToken,
  listarRubricasFiltradasCategoria,
);
router.post(
  "/rubricas/agregar/:id_edicion_categoria",
  verificarToken,
  agregarRubricaAEdicionCategoria,
);
router.post(
  "/rubricas/agregar-porcentajes/:id_edicion_categoria",
  verificarToken,
  agregarPorcentajesCriterio,
);
router.put(
  "/rubricas/editar-porcentaje-rubrica/:id_ecr",
  verificarToken,
  editarPorcentajeRubrica,
);
router.delete(
  "/rubricas/eliminar/:id_ecr",
  verificarToken,
  eliminarRubricaDeEdicionCategoria,
);
router.get(
  "/rubricas/criterios/:id_rubrica",
  verificarToken,
  obtenerRubricaCriterios,
);
router.get(
  "/evaluaciones/:id_participacion_jurado",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  obtenerEvaluaciones,
);

module.exports = router;

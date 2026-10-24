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
  verificarRol("director"),
  listarRubricasConCriterios,
);
router.post("/rubricas/crear", verificarToken, verificarRol("director"), crearRubrica);
router.post("/criterios/crear", verificarToken, verificarRol("director"), crearCriterio);
router.post("/rubricas/criterio", verificarToken, verificarRol("director"), crearRubricaCriterio);
router.put(
  "/rubricas/editar-porcentaje/:id_ecrc",
  verificarToken,
  verificarRol("director"),
  editarPorcentajeCriterio,
);
router.get(
  "/rubricas/filtradas/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  listarRubricasFiltradasCategoria,
);
router.post(
  "/rubricas/agregar/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  agregarRubricaAEdicionCategoria,
);
router.post(
  "/rubricas/agregar-porcentajes/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  agregarPorcentajesCriterio,
);
router.put(
  "/rubricas/editar-porcentaje-rubrica/:id_ecr",
  verificarToken,
  verificarRol("director"),
  editarPorcentajeRubrica,
);
router.delete(
  "/rubricas/eliminar/:id_ecr",
  verificarToken,
  verificarRol("director"),
  eliminarRubricaDeEdicionCategoria,
);
router.get(
  "/rubricas/criterios/:id_rubrica",
  verificarToken,
  verificarRol("director"),
  obtenerRubricaCriterios,
);
router.get(
  "/evaluaciones/:id_participacion_jurado",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  obtenerEvaluaciones,
);

module.exports = router;

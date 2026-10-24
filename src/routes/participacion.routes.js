const express = require("express");
const {
  listarParticipacionesPorEdicion,
  listarConvocatoriasPorEdicion,
  listarParticipacionesGanadorasPorEdicionCategoria,
  listarPostulacionesPorCategoriaEdicion,
  listarParticipacionesPorCategoriaEdicion,
  listarPostulacionesPorEdicion,
  listarParticipacionesGanadorasPorEdicion,
  obtenerParticipacion,
  obtenerParticipacionAEvaluar,
  obtenerParticipacionParticipante,
  listarJuradosParticipacion,
  agregarJuradoAParticipacion,
  editarRespuestaParticipacion,
  listarPostulaciones,
  mostrarDocumento,
  cambiarEstadoParticipacion,
  actualizarComentarios,
  cambiarEstadoAsignacionJurado,
} = require("../controller/participacion.controller");
const multerUpdateFile = require("../middlewares/multerUpdateFile");
const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");
const buscarRespuestaParticipacion = require("../middlewares/buscarRespuestaParticipacion");

const router = express.Router();

router.get(
  "/participaciones/edicion/:id_edicion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarParticipacionesPorEdicion,
);
router.get(
  "/convocatorias/:id_edicion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarConvocatoriasPorEdicion,
);
router.get(
  "/participaciones/ganadoras/categoria/:id_edicion_categoria",
  verificarToken,
  verificarRol("director"),
  listarParticipacionesGanadorasPorEdicionCategoria,
);
router.get(
  "/postulaciones/categoria/:id_edicion_categoria",
  verificarToken,
  verificarRol("director", "jurado", "participante"),
  listarPostulacionesPorCategoriaEdicion,
);
router.get(
  "/participaciones/categoria/:id_edicion_categoria",
  verificarToken,
  verificarRol("director", "jurado", "participante"),
  listarParticipacionesPorCategoriaEdicion,
);
router.get(
  "/postulaciones/:id_edicion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarPostulacionesPorEdicion,
);
router.get(
  "/participaciones/ganadoras/:id_edicion",
  verificarToken,
  verificarRol("director", "jurado", "participante"),
  listarParticipacionesGanadorasPorEdicion,
);
router.put(
  "/participaciones/requisitos/respuesta/:id_participacion_requisito",
  verificarToken,
  verificarRol("participante"),
  buscarRespuestaParticipacion,
  multerUpdateFile.single("archivo"),
  editarRespuestaParticipacion,
);
router.get(
  "/participaciones/:id_participacion/informacion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  obtenerParticipacion,
);
router.get(
  "/participaciones/evaluar/:id_participacion/informacion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  obtenerParticipacionAEvaluar,
);
router.get(
  "/participaciones/participante/:id_participacion/informacion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  obtenerParticipacionParticipante,
);
router.get(
  "/participaciones/jurados/:id_participacion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarJuradosParticipacion,
);
router.post(
  "/participaciones/jurados/:id_participacion",
  verificarToken,
  verificarRol("director"),
  agregarJuradoAParticipacion,
);
router.put(
  "/participaciones/jurados/:id_participacion_jurado",
  verificarToken,
  verificarRol("director"),
  cambiarEstadoAsignacionJurado,
);

router.get(
  "/postulaciones/:idEdicion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarPostulaciones,
);
router.get(
  "/documento/:id_participacion_requisito",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  mostrarDocumento,
);
router.put(
  "/participacion/:id_participacion",
  verificarToken,
  verificarRol("director"),
  cambiarEstadoParticipacion,
);
router.put(
  "/participacion/:id_participacion/comentarios",
  verificarToken,
  verificarRol("director"),
  actualizarComentarios,
);

module.exports = router;

const express = require("express");
const { validarSchema } = require("../middlewares/validarSchema");

const {
  listarDirectores,
  agregarDirector,
  editarInformacionDirector,
  cambiarEstadoDirector,
  obtenerDirector,
} = require("../controller/director.controller");

const {
  listarJurados,
  agregarJurado,
  editarInformacionJurado,
  cambiarEstadoJurado,
  obtenerJurado,
  listarJuradosPorEdicion,
  listarJuradosPorCategoriaEdicion,
  listarJuradosDisponiblesAsignar,
  obtenerEdicionesParticipacionJurado,
  obtenerCategoriasEdicionesParticipacionJurado,
  obtenerParticipacionesEvaluadasJurado,
  obtenerParticipacionesEdicion,
  registrarEvaluacion,
  editarEvaluacion,
} = require("../controller/jurado.controller");

const {
  listarParticipantes,
  editarInformacionParticipante,
  cambiarEstadoParticipante,
  agregarParticipante,
  obtenerParticipante,
  obtenerEdicionesParticipacionParticipante,
  obtenerCategoriasEdicionesParticipacionParticipante,
  obtenerConvocatoriasParticipante,
  obtenerParticipaciones,
  obtenerEdicionesPorParticipante,
  obtenerParticipacionesPorParticipante,
  generarCertificadoParticipacion,
  obtenerParticipacionesPorJurado,
} = require("../controller/participantes.controller");

const { actualizarDatos } = require("../schemas/autenticacion");
const {
  editarInformacionContacto,
  cambiarRolActivo,
  obtenerUsuarioPorCedula,
  obtenerUsuarioPorCedulaInscripcion,
  listarGanadoresEdicion,
  filtrarGanadoresEdicion,
} = require("../controller/usuario.controller");

const { verificarToken } = require("../utils/verificarToken");
const { verificarRol } = require("../utils/verificarRol");

const router = express.Router();

//Rutas para Directores
router.get(
  "/directores",
  verificarToken,
  verificarRol("administrador"),
  listarDirectores,
);
router.post(
  "/agregar-director",
  verificarToken,
  verificarRol("administrador"),
  agregarDirector,
);
router.put(
  "/editar-informacion-director/:numero_documento",
  verificarToken,
  verificarRol("administrador"),
  editarInformacionDirector,
);
router.put(
  "/cambiar-estado-director",
  verificarToken,
  verificarRol("administrador"),
  cambiarEstadoDirector,
);
router.get(
  "/obtener-director/:id_usuario",
  verificarToken,
  verificarRol("administrador"),
  obtenerDirector,
);

//Rutas para jurados
router.get(
  "/jurados",
  verificarToken,
  verificarRol("administrador", "director"),
  listarJurados,
);
router.post(
  "/agregar-jurado",
  verificarToken,
  verificarRol("administrador", "director"),
  agregarJurado,
);
router.put(
  "/editar-informacion-jurado/:numero_documento",
  verificarToken,
  verificarRol("administrador", "director"),
  editarInformacionJurado,
);
router.put(
  "/cambiar-estado-jurado",
  verificarToken,
  verificarRol("administrador", "director"),
  cambiarEstadoJurado,
);
router.get(
  "/obtener-jurado/:id_usuario",
  verificarToken,
  verificarRol("administrador", "director"),
  obtenerJurado,
);
router.get(
  "/jurados/edicion/:id_edicion",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarJuradosPorEdicion,
);
router.get(
  "/jurados/categoria/:id_edicion_categoria",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  listarJuradosPorCategoriaEdicion,
);
router.get(
  "/ediciones/jurado/:id_jurado",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  obtenerEdicionesParticipacionJurado,
);
router.get(
  "/ediciones/:id_edicion/categorias/jurado/:id_jurado",
  verificarToken,
  verificarRol("administrador", "director", "jurado", "participante"),
  obtenerCategoriasEdicionesParticipacionJurado,
);
router.get(
  "/jurados/:id_jurado/participaciones",
  verificarToken,
  obtenerParticipacionesEvaluadasJurado,
);
router.get(
  "/jurados/edicion/:id_edicion/participaciones",
  verificarToken,
  obtenerParticipacionesEdicion,
);
router.get(
  "/jurados-disponibles-asignar/:id_edicion",
  verificarToken,
  verificarRol("director"),
  listarJuradosDisponiblesAsignar,
);
router.post("/evaluacion-jurado", verificarToken, registrarEvaluacion);
router.put("/editar-evaluacion", verificarToken, editarEvaluacion);

//Rutas para Participantes
router.get(
  "/participantes",
  verificarToken,
  verificarRol("administrador", "director"),
  listarParticipantes,
);
router.post(
  "/agregar-participante",
  verificarToken,
  verificarRol("administrador"),
  agregarParticipante,
);
router.put(
  "/editar-informacion-participante/:numero_documento",
  verificarToken,
  editarInformacionParticipante,
);
router.put(
  "/cambiar-estado-participante",
  verificarToken,
  cambiarEstadoParticipante,
);
router.get(
  "/obtener-participante/:id_usuario",
  verificarToken,
  obtenerParticipante,
);
router.get(
  "/ediciones/participante/:id_participante",
  verificarToken,
  obtenerEdicionesParticipacionParticipante,
);
router.get(
  "/ediciones/:id_edicion/categorias/participante/:id_participante",
  verificarToken,
  obtenerCategoriasEdicionesParticipacionParticipante,
);
router.get(
  "/convocatorias/participante/:id_participante",
  verificarToken,
  obtenerConvocatoriasParticipante,
);
router.get(
  "/participaciones/:id_usuario",
  verificarToken,
  obtenerParticipaciones,
);
router.get(
  "/ediciones/participante/:id_participante",
  verificarToken,
  obtenerEdicionesPorParticipante,
);
router.get(
  "/participante/participaciones/:id_usuario",
  verificarToken,
  obtenerParticipacionesPorParticipante,
);
router.get(
  "/participantes/:id_participacion/certificado",
  generarCertificadoParticipacion,
);
router.get(
  "/listar-participaciones/:id_jurado",
  verificarToken,
  verificarRol("jurado"),
  obtenerParticipacionesPorJurado,
);

//Rutas de más
/*router.post(
  "/agregar-participante-sis",
  verificarToken,
  agregarParticipanteSis,
);*/
router.put(
  "/editar-informacion-contacto/:id_usuario",
  verificarToken,
  validarSchema(actualizarDatos),
  editarInformacionContacto,
);
router.put("/cambiar-rol-activo/:id_usuario", verificarToken, cambiarRolActivo);
router.get(
  "/obtener-usuario/:numero_documento",
  verificarToken,
  obtenerUsuarioPorCedula,
);
router.get(
  "/obtener-usuario-inscripcion/:numero_documento",
  obtenerUsuarioPorCedulaInscripcion,
);
router.get(
  "/ganadores-edicion/:id_edicion",
  verificarToken,
  verificarRol("director"),
  listarGanadoresEdicion,
);
router.get(
  "/filtrar-ganadores-edicion/:idEdicion",
  verificarToken,
  filtrarGanadoresEdicion,
);

module.exports = router;

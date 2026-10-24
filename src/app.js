const express = require("express");
const config = require("./config");
const sequelize = require("./configs/db");
const autenticacionRoutes = require("./routes/autenticacion.routes");
const edicionRoutes = require("./routes/edicion.routes");
const requisitosRoutes = require("./routes/requisitos.routes");
const categoriaRoutes = require("./routes/categoria.routes");
const usuarioRoutes = require("./routes/usuario.routes");
const participacionRoutes = require("./routes/participacion.routes");
const evaluacionRoutes = require("./routes/evaluacion.routes");
const rubricasRoutes = require("./routes/rubricas.routes");
const criteriosRoutes = require("./routes/criterios.routes");
const reportesRoutes = require("./routes/reportes.routes");
const notificacionesRoutes = require("./routes/notificaciones.routes");
const publicRoutes = require("./routes/public.routes");
const auditoriaRoutes = require("./routes/auditoria.routes");
const cors = require("cors");
const { limpiarOTP } = require("./middlewares/limpiarOTP");
const { edicionFinalizada } = require("./middlewares/edicionFinalizada");
const { edicionEnProceso } = require("./middlewares/edicionEnProceso");
const { notificarEdicion } = require("./middlewares/notificarEdicion");
const {
  notificarEtapaEvaluacion,
} = require("./middlewares/notificarEtapaEvaluacion");
const {
  notificarEtapaConvocatoria,
} = require("./middlewares/notificarEtapaConvocatoria");
const {
  notificarRecordatorioEvaluacionesPendientes,
} = require("./middlewares/notificarRecordatorioEvaluacionesPendientes");
const { procesarPremiacion } = require("./middlewares/procesarPremiacion");
const {
  validacionInicioEtapaEvaluacion,
} = require("./middlewares/validacionInicioEtapaEvaluacion");
const {
  validacionInicioEtapaConvocatoria,
} = require("./middlewares/validacionInicioEtapaConvocatoria");
const { archivarEdiciones } = require("./middlewares/archivarEdiciones");
const cookieParser = require("cookie-parser");

limpiarOTP();
edicionEnProceso();
edicionFinalizada();
notificarEdicion();
notificarEtapaEvaluacion();
notificarEtapaConvocatoria();
notificarRecordatorioEvaluacionesPendientes();
procesarPremiacion();
validacionInicioEtapaEvaluacion();
validacionInicioEtapaConvocatoria();
archivarEdiciones();

sequelize
  .authenticate()
  .then(() => console.log("Conexión a la base de datos establecida."))
  .catch((err) =>
    console.error("No se pudo conectar a la base de datos:", err),
  );

const allowedOrigins = [config.app.frontendUrl];

const app = express();

app.use(cookieParser());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.set("port", config.app.port);
app.use(express.json());

app.use(require("./middlewares/auditoria"));
app.use("/", autenticacionRoutes);
app.use("/", usuarioRoutes);
app.use("/", edicionRoutes);
app.use("/", requisitosRoutes);
app.use("/", categoriaRoutes);
app.use("/", participacionRoutes);
app.use("/", evaluacionRoutes);
app.use("/", rubricasRoutes);
app.use("/", criteriosRoutes);
app.use("/", reportesRoutes);
app.use("/", notificacionesRoutes);
app.use("/public", publicRoutes);
app.use("/", auditoriaRoutes);

module.exports = app;

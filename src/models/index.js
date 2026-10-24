const sequelize = require("../configs/db");
const Usuario = require("./usuarioModel");
const Auditoria = require("./auditoriaModel");
const Sesion = require("./sesionModel");
const UsuarioToken = require("./usuarioTokenModel");
const Rol = require("./rolModel");
const BloqueoUsuario = require("./bloqueoUsuarioModel");
const UsuarioRol = require("./usuarioRolModel");
const CodigoRecuperacion = require("./codigoRecuperacionModel");
const Edicion = require("./edicionModel");
const Convocatoria = require("./convocatoriaModel");
const Categoria = require("./categoriaModel");
const EdicionCategoria = require("./edicionCategoriaModel");
const ParticipacionJurado = require("./participacionJuradoModel");
const Participacion = require("./participacionModel");
const ParticipacionRequisito = require("./participacionRequisitoModel");
const RequisitosEdicion = require("./requisitosEdicionModel");
const RequisitoEdicionCategoria = require("./requisitosEdicionCategoriaModel");
const RequisitosEdicionCategoria = require("./requisitosEdicionCategoriaModel");
const RequisitosCategoriaConfig = require("./requisitoCategoriaConfigModel");
const RequisitosConfig = require("./requisitoConfigModel");
const Requisitos = require("./requisitosModel");
const Rubrica = require("./rubricaModel");
const Criterio = require("./criterioModel");
const RubricaCriterio = require("./rubricaCriterioModel");
const EdicionCategoriaRubricaCriterio = require("./edicionCategoriaRubricaCriterioModel");
const EdicionCategoriaRubrica = require("./edicionCategoriaRubricaModel");
const EvaluacionCriterio = require("./evaluacionCriterioModel");
const Notificacion = require("./notificacionesModel");

//Relación Usuario-Auditoria
Usuario.hasMany(Auditoria, {
  foreignKey: "usuario_id",
  sourceKey: "id_usuario",
  as: "auditorias",
});

Auditoria.belongsTo(Usuario, {
  foreignKey: "usuario_id",
  targetKey: "id_usuario",
  as: "usuario",
});

//Relación Usuario-Sesión
Usuario.hasOne(Sesion, { foreignKey: "id_usuario", as: "sesion" });
Sesion.belongsTo(Usuario, { foreignKey: "id_usuario", as: "usuario" });

//Relación Usuario-Rol
Usuario.belongsToMany(Rol, {
  through: UsuarioRol,
  foreignKey: "id_usuario",
  otherKey: "id_rol",
  as: "roles",
});

Rol.belongsToMany(Usuario, {
  through: UsuarioRol,
  foreignKey: "id_rol",
  otherKey: "id_usuario",
  as: "usuarios",
});

//Relación Usuario-Bloqueo
Usuario.hasOne(BloqueoUsuario, { foreignKey: "id_usuario", as: "bloqueo" });
BloqueoUsuario.belongsTo(Usuario, { foreignKey: "id_usuario", as: "usuario" });

//Relación Usuario-Código_Recuperación
Usuario.hasOne(CodigoRecuperacion, { foreignKey: "id_usuario", as: "codigo" });
CodigoRecuperacion.belongsTo(Usuario, {
  foreignKey: "id_usuario",
  as: "usuario",
});

//Relacion Usuario-Token
UsuarioToken.belongsTo(Usuario, { foreignKey: "id_usuario" });
Usuario.hasOne(UsuarioToken, { foreignKey: "id_usuario" });

//Relacion Edicion-Categoria
Edicion.belongsToMany(Categoria, {
  through: EdicionCategoria,
  foreignKey: "id_edicion",
  otherKey: "id_categoria",
});

Categoria.belongsToMany(Edicion, {
  through: EdicionCategoria,
  foreignKey: "id_categoria",
  otherKey: "id_edicion",
});

EdicionCategoria.belongsTo(Categoria, {
  foreignKey: "id_categoria",
  as: "categoria",
});

Categoria.hasMany(EdicionCategoria, {
  foreignKey: "id_categoria",
  as: "edicionesCategoria",
});

Edicion.hasMany(EdicionCategoria, {
  foreignKey: "id_edicion",
  as: "categoriasEdicion",
});

EdicionCategoria.belongsTo(Edicion, {
  foreignKey: "id_edicion",
  as: "edicion",
});

//Relacion Edicion-Participacion
Edicion.hasMany(Participacion, {
  foreignKey: "id_edicion",
  as: "participaciones",
});

Participacion.belongsTo(Edicion, {
  foreignKey: "id_edicion",
  as: "edicion",
});

//Relacion Participacion-Jurado
Participacion.hasMany(ParticipacionJurado, {
  foreignKey: "id_participacion",
  as: "juradosAsignados",
});

ParticipacionJurado.belongsTo(Participacion, {
  foreignKey: "id_participacion",
  as: "participacion",
});

//Relacion ParticipacionJurado-Usuario
Usuario.hasMany(ParticipacionJurado, {
  foreignKey: "id_jurado",
  as: "evaluacionesAsignadas",
});

ParticipacionJurado.belongsTo(Usuario, {
  foreignKey: "id_jurado",
  as: "jurado",
});

//Relacion Convocatoria-Edicion
Edicion.hasMany(Convocatoria, {
  foreignKey: "id_edicion",
  as: "Convocatoria",
});

Convocatoria.belongsTo(Edicion, {
  foreignKey: "id_edicion",
  as: "edicion",
});

//Relacion Convocatoria-Participacion
Convocatoria.belongsTo(Participacion, {
  foreignKey: "id_participacion",
  as: "participacion",
});

//Relacion Usuario-Participacion
Usuario.hasMany(Participacion, {
  foreignKey: "id_usuario",
  as: "participaciones",
});

Participacion.belongsTo(Usuario, {
  foreignKey: "id_usuario",
  as: "usuario",
});

//Relacion EdicionCategoria-Participacion
EdicionCategoria.hasMany(Participacion, {
  foreignKey: "id_edicion_categoria",
  as: "participaciones",
});

Participacion.belongsTo(EdicionCategoria, {
  foreignKey: "id_edicion_categoria",
  as: "edicionCategoria",
});

//Relacion ParticipacionJurado-EvaluacionCriterio
ParticipacionJurado.hasOne(EvaluacionCriterio, {
  foreignKey: "id_participacion_jurado",
  as: "evaluacion_criterio",
});

EvaluacionCriterio.belongsTo(ParticipacionJurado, {
  foreignKey: "id_participacion_jurado",
  as: "participacionJurado",
});

//Relacion EdicionCategoriaRubricaCriterio-EvaluacionCriterio
EdicionCategoriaRubricaCriterio.hasMany(EvaluacionCriterio, {
  foreignKey: "id_edicion_categoria_rubrica_criterio",
  as: "evaluacion_criterio",
});

EvaluacionCriterio.belongsTo(EdicionCategoriaRubricaCriterio, {
  foreignKey: "id_edicion_categoria_rubrica_criterio",
  as: "edicionCategoriaRubricaCriterio",
});

//Relacion Participacion-ParticipacionRequisito
Participacion.hasMany(ParticipacionRequisito, {
  foreignKey: "id_participacion",
  as: "respuestas",
});

ParticipacionRequisito.belongsTo(Participacion, {
  foreignKey: "id_participacion",
  as: "participacion",
});

//Relacion RequisitosEdicion-ParticipacionRequisito
RequisitosEdicion.hasMany(ParticipacionRequisito, {
  foreignKey: "id_requisito_edicion",
  as: "respuestas",
});

ParticipacionRequisito.belongsTo(RequisitosEdicion, {
  foreignKey: "id_requisito_edicion",
  as: "requisitoEdicion",
});

//Relacion RequisitoEdicionCategoria-ParticipacionRequisito
RequisitoEdicionCategoria.hasMany(ParticipacionRequisito, {
  foreignKey: "id_requisito_edicion_categoria",
  as: "respuestas",
});

ParticipacionRequisito.belongsTo(RequisitoEdicionCategoria, {
  foreignKey: "id_requisito_edicion_categoria",
  as: "requisitoEdicionCategoria",
});

//Relacion RequisitosEdicionCategoria-RequisitosCategoriaConfig
RequisitosEdicionCategoria.hasOne(RequisitosCategoriaConfig, {
  foreignKey: "id_requisito_edicion_categoria",
  as: "RequisitosCategoriaConfig",
});

RequisitosCategoriaConfig.belongsTo(RequisitosEdicionCategoria, {
  foreignKey: "id_requisito_edicion_categoria",
});

//Relacion RequisitosEdicion-RequisitosConfig
RequisitosEdicion.hasOne(RequisitosConfig, {
  foreignKey: "id_requisito_edicion",
  as: "RequisitosConfig",
});

RequisitosConfig.belongsTo(RequisitosEdicion, {
  foreignKey: "id_requisito_edicion",
});

//Relacion EdicionCategoria-Requisitos
EdicionCategoria.belongsToMany(Requisitos, {
  through: RequisitosEdicionCategoria,
  foreignKey: "id_edicion_categoria",
  otherKey: "id_requisito",
  as: "Requisitos",
});

Requisitos.belongsToMany(EdicionCategoria, {
  through: RequisitosEdicionCategoria,
  foreignKey: "id_requisito",
  otherKey: "id_edicion_categoria",
  as: "EdicionCategoria",
});

//Relacion Requisitos-RequisitosEdicionCategoria
Requisitos.hasMany(RequisitosEdicionCategoria, {
  foreignKey: "id_requisito",
  as: "RequisitosEdicionCategoria",
});

EdicionCategoria.hasMany(RequisitosEdicionCategoria, {
  foreignKey: "id_edicion_categoria",
  as: "RequisitosEdicionCategoria",
});

RequisitosEdicionCategoria.belongsTo(Requisitos, {
  foreignKey: "id_requisito",
});
RequisitosEdicionCategoria.belongsTo(EdicionCategoria, {
  foreignKey: "id_edicion_categoria",
});

Edicion.belongsToMany(Requisitos, {
  through: RequisitosEdicion,
  foreignKey: "id_edicion",
  otherKey: "id_requisito",
  as: "Requisitos",
});

Requisitos.belongsToMany(Edicion, {
  through: RequisitosEdicion,
  foreignKey: "id_requisito",
  otherKey: "id_edicion",
  as: "Ediciones",
});

Requisitos.hasMany(RequisitosEdicion, {
  foreignKey: "id_requisito",
  as: "RequisitosEdicion",
});

Edicion.hasMany(RequisitosEdicion, {
  foreignKey: "id_edicion",
  as: "RequisitosEdicion",
});

RequisitosEdicion.belongsTo(Requisitos, { foreignKey: "id_requisito" });
RequisitosEdicion.belongsTo(Edicion, { foreignKey: "id_edicion" });

Rubrica.hasMany(RubricaCriterio, {
  foreignKey: "id_rubrica",
});

RubricaCriterio.belongsTo(Rubrica, {
  foreignKey: "id_rubrica",
});

Criterio.hasMany(RubricaCriterio, {
  foreignKey: "id_criterio",
  as: "rubricaCriterio",
});

RubricaCriterio.belongsTo(Criterio, {
  foreignKey: "id_criterio",
});

EdicionCategoria.hasMany(EdicionCategoriaRubricaCriterio, {
  foreignKey: "id_edicion_categoria",
});

EdicionCategoriaRubricaCriterio.belongsTo(EdicionCategoria, {
  foreignKey: "id_edicion_categoria",
});

RubricaCriterio.hasMany(EdicionCategoriaRubricaCriterio, {
  foreignKey: "id_rubrica_criterio",
  as: "edicionCategoriaRubricaCriterio",
});

EdicionCategoriaRubricaCriterio.belongsTo(RubricaCriterio, {
  foreignKey: "id_rubrica_criterio",
  as: "rubricaCriterio",
});

EdicionCategoria.hasMany(EdicionCategoriaRubrica, {
  foreignKey: "id_edicion_categoria",
  as: "rubricas",
});

EdicionCategoriaRubrica.belongsTo(EdicionCategoria, {
  foreignKey: "id_edicion_categoria",
  as: "edicionCategoria",
});

Rubrica.hasMany(EdicionCategoriaRubrica, {
  foreignKey: "id_rubrica",
});

EdicionCategoriaRubrica.belongsTo(Rubrica, {
  foreignKey: "id_rubrica",
  as: "rubrica",
});

Usuario.hasMany(Notificacion, {
  foreignKey: "id_usuario",
  as: "notificaciones",
});

Notificacion.belongsTo(Usuario, {
  foreignKey: "id_usuario",
  as: "usuario",
});

Rol.hasMany(Notificacion, {
  foreignKey: "id_rol",
  as: "notificaciones",
});

Notificacion.belongsTo(Rol, {
  foreignKey: "id_rol",
  as: "rol",
});

module.exports = {
  sequelize,
  Usuario,
  Auditoria,
  Sesion,
  Rol,
  UsuarioRol,
  BloqueoUsuario,
  CodigoRecuperacion,
  Edicion,
  Convocatoria,
  Categoria,
  EdicionCategoria,
  ParticipacionJurado,
  Participacion,
  UsuarioToken,
  Requisitos,
  RequisitosEdicion,
  RequisitosEdicionCategoria,
  RequisitosCategoriaConfig,
  RequisitosConfig,
  RequisitosEdicionCategoria,
  RequisitosEdicion,
  RequisitosConfig,
  ParticipacionJurado,
  Participacion,
  ParticipacionRequisito,
  Rubrica,
  Criterio,
  RubricaCriterio,
  EdicionCategoriaRubricaCriterio,
  EdicionCategoriaRubrica,
  EvaluacionCriterio,
  Notificacion,
};

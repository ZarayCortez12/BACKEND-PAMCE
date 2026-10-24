const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Usuario = sequelize.define(
  "Usuario",
  {
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    tipo_documento: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    numero_documento: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    primer_nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    segundo_nombre: DataTypes.STRING(50),
    primer_apellido: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    segundo_apellido: DataTypes.STRING(50),
    correo_electronico: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    fecha_nacimiento: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    genero: {
      type: DataTypes.STRING(10),
    },
    direccion: {
      type: DataTypes.STRING(255),
    },
    contrasena: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nivel_estudio_superior: {
      type: DataTypes.STRING(100),
    },
    fecha_registro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    fecha_actualizacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    codigo_institucional: {
      type: DataTypes.STRING(15),
    },
    creo_contrasena: {
      type: DataTypes.BOOLEAN,
    },
  },
  {
    tableName: "usuarios",
    timestamps: false,
    // El hash de la contraseña nunca se devuelve en las consultas;
    // solo el login lo pide explícitamente con el scope "conContrasena"
    defaultScope: {
      attributes: { exclude: ["contrasena"] },
    },
    scopes: {
      conContrasena: {
        attributes: { include: ["contrasena"] },
      },
    },
  },
);

module.exports = Usuario;

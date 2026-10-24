const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const UsuarioRol = sequelize.define(
  "UsuarioRol",
  {
    id_usuario: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    id_rol: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: {
        model: "roles",
        key: "id_rol",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    estado_rol: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "activo",
    },
    fecha_registro: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_actualizacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "usuario_rol",
    timestamps: false,
  },
);

module.exports = UsuarioRol;

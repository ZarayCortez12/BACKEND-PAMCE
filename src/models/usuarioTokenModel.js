const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const UsuarioToken = sequelize.define(
  "usuarioToken",
  {
    id_token: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    usado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    fecha_expiracion: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "usuario_tokens",
    timestamps: false,
  },
);

module.exports = UsuarioToken;

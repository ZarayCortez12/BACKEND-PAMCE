const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const BloqueoUsuario = sequelize.define(
  "BloqueoUsuario",
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
    intentos_fallidos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bloqueado_hasta: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    fecha_actualizacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "bloqueos_usuario",
    timestamps: false,
  },
);

module.exports = BloqueoUsuario;

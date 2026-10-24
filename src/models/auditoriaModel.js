const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Auditoria = sequelize.define(
  "Auditoria",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    evento: {
      type: DataTypes.STRING(15),
    },
    tabla: {
      type: DataTypes.TEXT,
    },
    registro_id: {
      type: DataTypes.TEXT,
    },
    valores_anteriores: {
      type: DataTypes.JSONB,
    },
    valores_nuevos: {
      type: DataTypes.JSONB,
    },
    url: {
      type: DataTypes.TEXT,
    },
    metodo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fecha: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "auditoria",
    timestamps: false,
  },
);

module.exports = Auditoria;

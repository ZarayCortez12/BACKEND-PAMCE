const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Requisitos = sequelize.define(
  "Requisitos",
  {
    id_requisito: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    descripcion: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    fecha_registro: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "requisitos",
    timestamps: false,
  }
);

module.exports = Requisitos;

const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Criterio = sequelize.define(
  "Criterio",
  {
    id_criterio: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    estado: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },

  {
    tableName: "criterio",
    timestamps: false,
  },
);

module.exports = Criterio;

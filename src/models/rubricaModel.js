const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Rubrica = sequelize.define(
  "Rubrica",
  {
    id_rubrica: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
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
    tableName: "rubrica",
    timestamps: false,
  },
);

module.exports = Rubrica;

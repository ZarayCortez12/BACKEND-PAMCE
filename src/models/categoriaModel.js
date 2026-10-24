const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Categoria = sequelize.define(
  "Categoria",
  {
    id_categoria: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre_categoria: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
  },
  {
    tableName: "categorias",
    timestamps: false,
  }
);

module.exports = Categoria;

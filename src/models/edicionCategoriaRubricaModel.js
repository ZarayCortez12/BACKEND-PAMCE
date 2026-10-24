const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const EdicionCategoriaRubrica = sequelize.define(
  "EdicionCategoriaRubrica",
  {
    id_ecr: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    id_edicion_categoria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "edicion_categoria",
        key: "id_categoria",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    id_rubrica: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "rubrica",
        key: "id_rubrica",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    porcentaje: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
  },

  {
    tableName: "edicion_categoria_rubrica",
    timestamps: false,
  },
);

module.exports = EdicionCategoriaRubrica;

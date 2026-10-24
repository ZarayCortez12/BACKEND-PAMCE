const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const EdicionCategoriaRubricaCriterio = sequelize.define(
  "EdicionCategoriaRubricaCriterio",
  {
    id_ecrc: {
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
    id_rubrica_criterio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "rubrica_criterio",
        key: "id_rubrica_criterio",
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
    tableName: "edicion_categoria_rubrica_criterio",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["id_edicion_categoria", "id_rubrica_criterio"],
      },
    ],
  },
);

module.exports = EdicionCategoriaRubricaCriterio;

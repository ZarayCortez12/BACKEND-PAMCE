const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const RubricaCriterio = sequelize.define(
  "RubricaCriterio",
  {
    id_rubrica_criterio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
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
    id_criterio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "criterio",
        key: "id_criterio",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
  },

  {
    tableName: "rubrica_criterio",
    timestamps: false,
  },
);

module.exports = RubricaCriterio;

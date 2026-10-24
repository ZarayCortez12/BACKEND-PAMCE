const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const EvaluacionCriterio = sequelize.define(
  "EvaluacionCriterio",
  {
    id_evaluacion_criterio: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    id_participacion_jurado: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "participacion_jurado",
        key: "id_participacion_jurado",
      },
    },

    id_edicion_categoria_rubrica_criterio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "edicion_categoria_rubrica_criterio",
        key: "id_ecrc",
      },
    },

    calificacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    observacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    fecha_evaluacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "evaluacion_criterio",
    timestamps: false,
  },
);

module.exports = EvaluacionCriterio;

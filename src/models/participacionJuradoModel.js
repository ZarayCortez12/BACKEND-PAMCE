const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const ParticipacionJurado = sequelize.define(
  "ParticipacionJurado",
  {
    id_participacion_jurado: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    id_participacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "participacion",
        key: "id_participacion",
      },
    },

    id_jurado: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
    },

    estado: {
      type: DataTypes.ENUM("asignado", "evaluado", "retirado", "no_evaluado"),
      allowNull: false,
      defaultValue: "asignado",
    },

    observacion: {
      type: DataTypes.STRING,
    },

    fecha_asignacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    fecha_evaluacion: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "participacion_jurado",
    timestamps: false,
  },
);

module.exports = ParticipacionJurado;

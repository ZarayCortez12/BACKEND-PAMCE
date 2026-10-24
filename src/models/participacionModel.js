const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Participacion = sequelize.define(
  "Participacion",
  {
    id_participacion: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
    },
    id_edicion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "ediciones",
        key: "id_edicion",
      },
    },
    id_edicion_categoria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "edicion_categoria",
        key: "id_edicion_categoria",
      },
    },

    estado: {
      type: DataTypes.ENUM("pendiente", "aceptada", "rechazada", "evaluada"),
      allowNull: false,
      defaultValue: "pendiente",
    },

    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    comentarios: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    fecha_postulacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    fecha_revision: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    fecha_resultado: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    calificacion_final: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },

    fecha_resultados: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    es_ganador: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },

    puesto: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "participacion",
    timestamps: false,
  },
);

module.exports = Participacion;

const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Edicion = sequelize.define(
  "Edicion",
  {
    id_edicion: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre_edicion: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    fecha_inicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_fin: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_inicio_convocatoria: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_fin_convocatoria: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_inicio_evaluacion: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_fin_evaluacion: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_inicio_premiacion: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_fin_premiacion: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_procesamiento_premiacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    estado_edicion: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    fecha_registro: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_actualizacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    observacion: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    fecha_eliminacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "ediciones",
    timestamps: false,
  },
);

module.exports = Edicion;

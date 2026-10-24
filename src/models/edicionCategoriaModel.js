const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const EdicionCategoria = sequelize.define(
  "EdicionCategoria",
  {
    id_edicion_categoria: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_edicion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "ediciones",
        key: "id_edicion",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    id_categoria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "categorias",
        key: "id_categoria",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    numero_ganadores: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado: {
      type: DataTypes.STRING(45),
      defaultValue: true,
    },
    observacion_inactivacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fecha_registro: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fecha_actualizacion: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "edicion_categoria",
    timestamps: false,
  }
);

module.exports = EdicionCategoria;

const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const HistoricoEdicion = sequelize.define(
  "HistoricoEdicion",
  {
    id_historico: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    id_edicion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
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

    total_categorias: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    total_postulaciones: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    total_participaciones: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    total_jurados: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    total_evaluaciones: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    total_documentos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    bytes_documentos_liberados: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },

    datos: {
      type: DataTypes.JSON,
      allowNull: false,
    },

    checksum: {
      type: DataTypes.CHAR(64),
      allowNull: false,
    },

    version_esquema: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    tamano_json_bytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },

    archivos_no_eliminados: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },

    fecha_archivado: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    archivado_por: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "historico_ediciones",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = HistoricoEdicion;

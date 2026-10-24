const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Convocatoria = sequelize.define(
  "Convocatoria",
  {
    id_convocatoria: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    correo_electronico: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    estado_envio: {
      type: DataTypes.ENUM("enviado", "postulado"),
      allowNull: false,
      defaultValue: "enviado",
    },
    fecha_envio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_respuesta: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    intentos_envio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    fecha_ultimo_envio: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    id_participacion: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "participacion",
        key: "id_participacion",
      },
    },
  },
  {
    tableName: "convocatoria",
    timestamps: false,
  },
);

module.exports = Convocatoria;

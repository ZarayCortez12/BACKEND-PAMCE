const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const CodigoRecuperacion = sequelize.define(
  "CodigoRecuperacion",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    codigo: {
      type: DataTypes.STRING(6),
      allowNull: false,
    },
    usado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_expiracion: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "codigo_recuperacion",
    timestamps: false,
  },
);

module.exports = CodigoRecuperacion;

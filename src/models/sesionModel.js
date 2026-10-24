const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Sesion = sequelize.define(
  "Sesion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fecha_expiracion: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "sesiones",
    timestamps: false,
  },
);

module.exports = Sesion;

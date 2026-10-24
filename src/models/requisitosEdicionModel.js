const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const RequisitosEdicion = sequelize.define(
  "RequisitosEdicion",
  {
    id_requisito_edicion: {
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
    id_requisito: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "requisitos",
        key: "id_requisito",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    obligatorio: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    tipo_requisito: {
      type: DataTypes.ENUM("documento", "texto"),
      allowNull: false,
      defaultValue: "documento",
    },
  },
  {
    tableName: "requisito_edicion",
    timestamps: false,
  }
);

module.exports = RequisitosEdicion;

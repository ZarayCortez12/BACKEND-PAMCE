const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const RequisitosEdicionCategoria = sequelize.define(
  "RequisitosEdicionCategoria",
  {
    id_requisito_edicion_categoria: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_edicion_categoria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "edicion_categoria",
        key: "id_edicion_categoria",
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
    tableName: "requisito_edicion_categoria",
    timestamps: false,
  }
);

module.exports = RequisitosEdicionCategoria;

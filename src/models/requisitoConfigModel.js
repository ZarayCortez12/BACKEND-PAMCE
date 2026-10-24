const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const RequisitosConfig = sequelize.define(
  "RequisitosConfig",
  {
    id_config: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_requisito_edicion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "requisito_edicion",
        key: "id_requisito_edicion",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    extensiones_permitidas: {
      type: DataTypes.STRING(100),
    },
    tamano_max_mb: {
      type: DataTypes.INTEGER,
    },
    fecha_registro: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    max_caracteres: {
      type: DataTypes.INTEGER,
    },
  },
  {
    tableName: "requisito_config",
    timestamps: false,
  }
);

module.exports = RequisitosConfig;

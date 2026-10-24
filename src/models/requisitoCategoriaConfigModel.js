const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const RequisitosCategoriaConfig = sequelize.define(
  "RequisitosCategoriaConfig",
  {
    id_config: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_requisito_edicion_categoria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "requisito_edicion_categoria",
        key: "id_requisito_edicion_categoria",
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
    tableName: "requisito_categoria_config",
    timestamps: false,
  },
);

module.exports = RequisitosCategoriaConfig;

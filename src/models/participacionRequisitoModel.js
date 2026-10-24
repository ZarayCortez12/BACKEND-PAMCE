const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const ParticipacionRequisito = sequelize.define(
  "ParticipacionRequisito",
  {
    id_participacion_requisito: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    id_participacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "participacion",
        key: "id_participacion",
      },
    },

    id_requisito_edicion: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "requisito_edicion",
        key: "id_requisito_edicion",
      },
    },

    id_requisito_edicion_categoria: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "requisito_edicion_categoria",
        key: "id_requisito_edicion_categoria",
      },
    },

    tipo_respuesta: {
      type: DataTypes.ENUM("documento", "texto"),
      allowNull: false,
    },

    valor_texto: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    ruta_archivo: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },

    nombre_archivo: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    extension_archivo: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    tamano_bytes: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    fecha_envio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "participacion_requisito",
    timestamps: false,

    validate: {
      unSoloRequisito() {
        if (
          (this.id_requisito_edicion && this.id_requisito_edicion_categoria) ||
          (!this.id_requisito_edicion && !this.id_requisito_edicion_categoria)
        ) {
          throw new Error(
            "Debe existir SOLO un requisito: edición o edición-categoría"
          );
        }
      },
    },
  }
);

module.exports = ParticipacionRequisito;

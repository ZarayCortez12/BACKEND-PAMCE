const { writeFileSync } = require("fs");
const sequelizeErd = require("sequelize-erd");

// Importa el objeto completo desde models/index.js
// Esto ejecuta las asociaciones y trae la instancia de sequelize
const db = require("../models/index");
const sequelize = db.sequelize;

(async function () {
  try {
    const svg = await sequelizeErd({
      source: sequelize,
      format: "svg",
      engine: 'neato',
      color: "blue",
      arrowSize: 1.2,
      lineWidth: 1,
    });

    writeFileSync("./diagrama-modelos.svg", svg);
  } catch (error) {
    console.error("Error al generar el diagrama:", error);
  }
})();

const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    timezone: "-05:00",
    dialectOptions: {
      useUTC: false,
      dateStrings: true,
      typeCast: true,
    },
    logging: false,
    port: process.env.DB_PORT,

    minifyAliases: false,
  }
);

module.exports = sequelize;

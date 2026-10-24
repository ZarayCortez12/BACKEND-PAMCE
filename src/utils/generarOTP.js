const crypto = require("crypto");

// Código de 6 dígitos con un generador criptográficamente seguro
// (Math.random es predecible y no sirve para códigos de seguridad)
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = generateOTP;

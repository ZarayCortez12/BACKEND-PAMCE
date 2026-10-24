const jwt = require("jsonwebtoken");
const { Sesion } = require("../models");

const verificarToken = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return res
        .status(401)
        .json({ message: "No autorizado. Token no encontrado" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    const sesion = await Sesion.findOne({
      where: {
        id_usuario: decoded.data.id_usuario,
        token: token,
      },
    });

    if (!sesion) {
      return res.status(401).json({
        message: "Sesión inválida o cerrada",
      });
    }

    req.usuario = decoded;

    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};

module.exports = { verificarToken };

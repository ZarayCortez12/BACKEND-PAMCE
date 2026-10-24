const { UsuarioRol } = require("../models");

const verificarRol = (...rolesPermitidos) => {
  return async (req, res, next) => {
    try {
      const idUsuario = req.user?.data?.id_usuario;
      const rolActivo = req.user?.data?.rol_activo;

      if (!idUsuario || !rolActivo) {
        return res.status(403).json({
          message: "El usuario no tiene un rol activo",
        });
      }

      const usuarioRol = await UsuarioRol.findOne({
        where: {
          id_usuario: idUsuario,
          id_rol: rolActivo.id_rol,
          estado_rol: "activo",
        },
      });

      if (!usuarioRol) {
        return res.status(403).json({
          message: "El rol activo del usuario no se encuentra disponible",
        });
      }

      if (!rolesPermitidos.includes(rolActivo.nombre_rol)) {
        return res.status(403).json({
          message: "No tienes permisos para acceder a este recurso",
        });
      }

      next();
    } catch (error) {
      console.error("Error al verificar el rol:", error);

      return res.status(500).json({
        message: "Error al verificar los permisos del usuario",
      });
    }
  };
};

module.exports = { verificarRol };

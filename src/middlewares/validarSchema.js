export const validarSchema = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      errores: error.issues.map((e) => ({
        campo: e.path[0],
        mensaje: e.message,
      })),
    });
  }
};

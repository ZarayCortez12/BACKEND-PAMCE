module.exports = (req, res, next) => {
  req.audit = {
    usuario_id: req.user?.id || null,
    url: req.originalUrl,
    metodo: req.method,
    ip: req.ip,
  };
  next();
};

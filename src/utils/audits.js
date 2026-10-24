const setAuditContext = async (sequelize, req, transaction) => {
  await sequelize.query(
    `
    SET LOCAL app.usuario_id = :usuario_id;
    SET LOCAL app.url = :url;
    SET LOCAL app.metodo = :metodo;
    SET LOCAL app.ip = :ip;
  `,
    {
      replacements: {
        usuario_id: req.audit.usuario_id,
        url: req.audit.url,
        metodo: req.audit.metodo,
        ip: req.audit.ip,
      },
      transaction,
    },
  );
};

module.exports = { setAuditContext };

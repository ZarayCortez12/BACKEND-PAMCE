const { Usuario, Auditoria } = require("../models");
const { Op, where } = require("sequelize");
const { id, ca } = require("zod/locales");
const sequelize = require("../configs/db");

const listarRegistrosAuditoria = async (req, res) => {
  try {
    const { search = "", evento, usuario_id, page, limit } = req.query;

    const queryOptions = {
      where: {
        ...(usuario_id && usuario_id !== "TODOS" && { usuario_id }),
        ...(evento && evento !== "TODOS" && { evento }),
      },
      include: [
        {
          model: Usuario,
          as: "usuario",
          where: {
            ...(search && {
              [Op.or]: [
                { numero_documento: { [Op.iLike]: `%${search}%` } },
                { primer_nombre: { [Op.iLike]: `%${search}%` } },
                { segundo_nombre: { [Op.iLike]: `%${search}%` } },
                { primer_apellido: { [Op.iLike]: `%${search}%` } },
                { segundo_apellido: { [Op.iLike]: `%${search}%` } },
                { correo_electronico: { [Op.iLike]: `%${search}%` } },
              ],
            }),
          },
        },
      ],
      distinct: true,
    };

    if (page && limit) {
      queryOptions.order = [["fecha", "DESC"]];
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Auditoria.findAndCountAll(queryOptions);

    return res.json({
      message: "Registros de auditoría obtenidos correctamente",
      registros: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error("Error al obtener registros de auditoría:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const obtenerRegistroAuditoria = async (req, res) => {
  try {
    const { id_registro } = req.params;

    const registro = await Auditoria.findOne({
      where: {
        id: id_registro,
      },
      include: [
        {
          model: Usuario,
          as: "usuario",
        },
      ],
    });

    return res.json({
      message: "Registro de auditoría obtenido correctamente",
      registro,
    });
  } catch (error) {
    console.error("Error al obtener registro de auditoría:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

module.exports = {
  listarRegistrosAuditoria,
  obtenerRegistroAuditoria,
};

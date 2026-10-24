const { Op, fn, col, where } = require("sequelize");
const jwt = require("jsonwebtoken");
const sequelize = require("../configs/db");
const {
  Requisitos,
  Edicion,
  RequisitosEdicion,
  RequisitosEdicionCategoria,
  EdicionCategoria,
  RequisitosConfig,
  RequisitosCategoriaConfig,
} = require("../models");
const { setAuditContext } = require("../utils/audits");

const listarRequisitosPorCategoriaEdicion = async (req, res) => {
  try {
    const { id_edicion_categoria } = req.params;
    const { search = "", tipo_requisito, obligatorio, page, limit } = req.query;

    const queryOptions = {
      where: {
        id_edicion_categoria,
        ...(obligatorio && obligatorio !== "TODOS" && { obligatorio }),
        ...(tipo_requisito && tipo_requisito !== "TODOS" && { tipo_requisito }),
      },
      include: [
        {
          model: Requisitos,
          as: "Requisito",
          where: {
            ...(search && {
              descripcion: { [Op.iLike]: `%${search}%` },
            }),
          },
          required: true,
        },
        {
          model: RequisitosCategoriaConfig,
          as: "RequisitosCategoriaConfig",
          required: true,
        },
      ],
      distinct: true,
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } =
      await RequisitosEdicionCategoria.findAndCountAll(queryOptions);

    return res.json({
      message: "Requisitos de la categoria obtenidos correctamente",
      requisitos: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerConfiguracionRequisitoDeCategoriaEdicion = async (req, res) => {
  try {
    const { id_requisito_edicion_categoria } = req.params;

    const configuracion = await RequisitosCategoriaConfig.findOne({
      where: { id_requisito_edicion_categoria },
    });

    return res.json({
      message: "Configuración del requisitos obtenida correctamente",
      configuracion: configuracion,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarRequisitosEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;
    const { search = "", tipo_requisito, obligatorio, page, limit } = req.query;

    const edicion = await Edicion.findByPk(id_edicion);

    if (!edicion) {
      return res.status(404).json({ message: "Edición no encontrada" });
    }

    const queryOptions = {
      where: {
        id_edicion,
        ...(obligatorio && obligatorio !== "TODOS" && { obligatorio }),
        ...(tipo_requisito && tipo_requisito !== "TODOS" && { tipo_requisito }),
      },
      include: [
        {
          model: Requisitos,
          as: "Requisito",
          where: {
            ...(search && {
              descripcion: { [Op.iLike]: `%${search}%` },
            }),
          },
          required: true,
        },
        {
          model: RequisitosConfig,
          as: "RequisitosConfig",
          required: true,
        },
      ],
      distinct: true,
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } =
      await RequisitosEdicion.findAndCountAll(queryOptions);

    if (count === 0) {
      return res
        .status(404)
        .json({ message: "Esta edición aún no tiene requisitos definidos" });
    }

    return res.json({
      message: "Requisitos de la edición obtenidos correctamente",
      requisitos: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const listarRequisitosEdicionInscripcion = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token no proporcionado",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        message: "Token inválido o expirado",
      });
    }

    if (!decoded.id_edicion) {
      return res.status(403).json({
        message: "Token no autorizado para esta edición",
      });
    }

    const { idEdicion } = req.params;

    if (Number(idEdicion) !== Number(decoded.id_edicion)) {
      return res.status(403).json({
        message: "El token no corresponde a esta edición",
      });
    }

    const edicion = await Edicion.findByPk(idEdicion, {
      attributes: ["id_edicion"],
      include: [
        {
          model: RequisitosEdicion,
          as: "RequisitosEdicion",
          attributes: ["id_requisito_edicion", "obligatorio", "tipo_requisito"],
          include: [
            {
              model: Requisitos,
              attributes: ["id_requisito", "descripcion"],
            },
            {
              model: RequisitosConfig,
              as: "RequisitosConfig",
              attributes: [
                "extensiones_permitidas",
                "tamano_max_mb",
                "max_caracteres",
              ],
            },
          ],
        },
      ],
    });

    if (!edicion) {
      return res.status(404).json({ message: "Edición no encontrada" });
    }

    if (edicion.RequisitosEdicion.length === 0) {
      return res
        .status(404)
        .json({ message: "Esta edición aún no tiene requisitos definidos" });
    }

    return res.json({
      mensaje: "Requisitos de la Edición obtenidos correctamente",
      requisitosEdicionInscripcion: edicion.RequisitosEdicion,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const filtrarRequisitosEdicion = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;
    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { idEdicion } = req.params;
    let { tipo_requerimiento, obligatorio } = req.query;

    if (tipo_requerimiento === "TODOS") tipo_requerimiento = null;
    if (obligatorio === "TODOS") obligatorio = null;
    if (obligatorio === "true") obligatorio = true;
    if (obligatorio === "false") obligatorio = false;

    const whereClause = {};
    if (tipo_requerimiento) whereClause.tipo_requisito = tipo_requerimiento;
    if (obligatorio !== null) whereClause.obligatorio = obligatorio;

    const edicion = await Edicion.findByPk(idEdicion, {
      attributes: ["id_edicion"],
      include: [
        {
          model: RequisitosEdicion,
          as: "RequisitosEdicion",
          where: whereClause,
          required: false,
          attributes: ["id_requisito_edicion", "obligatorio", "tipo_requisito"],
          include: [
            {
              model: Requisitos,
              attributes: ["id_requisito", "descripcion"],
            },
            {
              model: RequisitosConfig,
              as: "RequisitosConfig",
              attributes: [
                "extensiones_permitidas",
                "tamano_max_mb",
                "max_caracteres",
              ],
            },
          ],
        },
      ],
    });
    return res.json({
      mensaje: "Requisitos filtrados correctamente",
      requisitosEdicion: edicion.RequisitosEdicion || [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const crearRequisito = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { descripcion } = req.body;

    const normalizarTexto = (texto) =>
      texto.replace(/\s+/g, " ").trim().toLowerCase();

    const descripcionNormalizada = normalizarTexto(descripcion);

    const existe = await Requisitos.findOne({
      where: { descripcion: descripcionNormalizada },
      transaction,
    });

    if (!!existe) {
      await transaction.rollback();
      return res.status(200).json({
        requisito: existe,
      });
    }

    const requisito = await Requisitos.create(
      {
        descripcion: descripcion.trim(),
        fecha_registro: new Date(),
      },
      { transaction },
    );

    await transaction.commit();

    res.status(201).json({
      message: "Requisito creado correctamente",
      requisito,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const agregarRequisitoEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_requisito, obligatorio, tipo, config } = req.body;
    const { id_edicion } = req.params;

    const existe_edicion = await RequisitosEdicion.findOne({
      where: {
        id_edicion: id_edicion,
        id_requisito: id_requisito,
      },
      transaction,
    });

    if (existe_edicion) {
      return res.status(400).json({
        message: "El requisito ya está definido para esta edición",
      });
    }

    if (tipo === "documento") {
      if (!config?.extensiones_permitidas || !config?.tamano_max_mb) {
        throw new Error("Configuración de documento inválida");
      }
    }

    if (tipo === "texto") {
      if (!config?.max_caracteres) {
        throw new Error("Debe indicar el máximo de caracteres");
      }
    }

    const requisito = await RequisitosEdicion.create(
      {
        id_edicion: id_edicion,
        id_requisito: id_requisito,
        obligatorio: obligatorio,
        tipo_requisito: tipo,
      },
      { transaction },
    );

    const requisito_config = await RequisitosConfig.create(
      {
        id_requisito_edicion: requisito.id_requisito_edicion,
        extensiones_permitidas:
          config.extensiones_permitidas?.join(",") || null,
        tamano_max_mb: config.tamano_max_mb || null,
        max_caracteres: config.max_caracteres || null,
      },
      { transaction },
    );

    await transaction.commit();

    res.status(201).json({
      message: "Requisito agregado a la edición correctamente",
      requisito: requisito,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const editarRequisito = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { idEdicionRequisito } = req.params;
    const { obligatorio, config } = req.body;

    if (!idEdicionRequisito) {
      return res
        .status(400)
        .json({ error: "Falta el ID del requisito de edición" });
    }

    const requisitoEdicion = await RequisitosEdicion.findByPk(
      idEdicionRequisito,
      { transaction: t },
    );

    if (!requisitoEdicion) {
      return res.status(404).json({ error: "Requisito no encontrado" });
    }

    requisitoEdicion.obligatorio = obligatorio ? 1 : 0;
    await requisitoEdicion.save({ transaction: t });

    const requisitoConfig = await RequisitosConfig.findOne({
      where: { id_requisito_edicion: idEdicionRequisito },
      transaction: t,
    });

    if (!requisitoConfig) {
      return res
        .status(404)
        .json({ error: "Configuración del requisito no encontrada" });
    }

    if (requisitoEdicion.tipo_requisito === "documento") {
      requisitoConfig.extensiones_permitidas =
        config.extensiones_permitidas.join(",");
      requisitoConfig.tamano_max_mb = config.tamano_max_mb;
      requisitoConfig.max_caracteres = null;
    }

    if (requisitoEdicion.tipo_requisito === "texto") {
      requisitoConfig.max_caracteres = config.max_caracteres;
      requisitoConfig.extensiones_permitidas = null;
      requisitoConfig.tamano_max_mb = null;
    }

    await requisitoConfig.save({ transaction: t });

    const requisitoBase = await Requisitos.findByPk(
      requisitoEdicion.id_requisito,
      {
        attributes: ["id_requisito", "descripcion"],
        transaction: t,
      },
    );

    await t.commit();

    const requisitoEditado = {
      Requisito: {
        id_requisito: requisitoBase.id_requisito,
        descripcion: requisitoBase.descripcion,
      },
      RequisitosConfig: {
        extensiones_permitidas: requisitoConfig.extensiones_permitidas,
        tamano_max_mb: requisitoConfig.tamano_max_mb,
        max_caracteres: requisitoConfig.max_caracteres,
      },

      id_requisito_edicion: requisitoEdicion.id_requisito_edicion,
      obligatorio: Boolean(requisitoEdicion.obligatorio),
      tipo_requisito: requisitoEdicion.tipo_requisito,
    };

    res.status(200).json({
      message: "Requisito editado correctamente",
      requisito: requisitoEditado,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({
      error: error.message || "Error en el servidor",
    });
  }
};

const eliminarRequisito = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { idEdicionRequisito } = req.params;

    const requisito = await RequisitosEdicion.findByPk(idEdicionRequisito);
    if (!requisito) {
      return res.status(404).json({ error: "Requisito no encontrado" });
    }

    const requisitoEdicion = await RequisitosEdicion.findByPk(
      idEdicionRequisito,
      { transaction: t },
    );

    if (!requisitoEdicion) {
      return res.status(404).json({ message: "Requisito no encontrado" });
    }

    await requisitoEdicion.destroy({ transaction: t });

    await t.commit();

    res.status(200).json({
      message: "Requisito eliminado correctamente",
      idEdicionRequisito,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({
      error: error.message || "Error en el servidor",
    });
  }
};

const listarRequisitosCategoriaEdicionInscripcion = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token no proporcionado",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        message: "Token inválido o expirado",
      });
    }

    if (!decoded.id_edicion) {
      return res.status(403).json({
        message: "Token no autorizado para esta edición",
      });
    }

    const { idEdicionCategoria } = req.params;
    const { idEdicion } = req.query;

    if (Number(idEdicion) !== Number(decoded.id_edicion)) {
      return res.status(403).json({
        message: "El token no corresponde a esta edición",
      });
    }

    const edicionCategoria = await EdicionCategoria.findByPk(
      idEdicionCategoria,
      {
        attributes: ["id_edicion_categoria"],
        include: [
          {
            model: RequisitosEdicionCategoria,
            as: "RequisitosEdicionCategoria",
            attributes: [
              "id_requisito_edicion_categoria",
              "obligatorio",
              "tipo_requisito",
            ],
            include: [
              {
                model: Requisitos,
                attributes: ["id_requisito", "descripcion"],
              },
              {
                model: RequisitosCategoriaConfig,
                as: "RequisitosCategoriaConfig",
              },
            ],
          },
        ],
      },
    );

    if (!edicionCategoria) {
      return res.status(404).json({ message: "Categoria no encontrada" });
    }

    if (edicionCategoria.RequisitosEdicionCategoria.length === 0) {
      return res
        .status(404)
        .json({ message: "Esta categoria aún no tiene requisitos definidos" });
    }

    const requisitosFormateados =
      edicionCategoria.RequisitosEdicionCategoria.map((req) => {
        const conf = req.RequisitosCategoriaConfig;

        const configFormateada = conf
          ? {
              id_config: conf.dataValues.id_config,
              id_requisito_edicion_categoria: conf.dataValues.id_requisi,
              extensiones_permitidas: conf.dataValues.extensione,
              tamano_max_mb: conf.dataValues.tamano_max,
              fecha_registro: conf.dataValues.fecha_regi,
              max_caracteres: conf.dataValues.max_caract,
            }
          : null;

        return {
          id_requisito_edicion_categoria: req.id_requisito_edicion_categoria,
          obligatorio: req.obligatorio,
          tipo_requisito: req.tipo_requisito,
          Requisito: req.Requisito,
          RequisitosCategoriaConfig: configFormateada,
        };
      });

    return res.json({
      mensaje: "Requisitos de la categoria obtenidos correctamente",
      requisitosEdicionCategoriaInscripcion: requisitosFormateados,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const filtrarRequisitosCategoriaEdicion = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;
    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { idEdicionCategoria } = req.params;
    let { tipo_requerimiento, obligatorio } = req.query;

    if (tipo_requerimiento === "TODOS") tipo_requerimiento = null;
    if (obligatorio === "TODOS") obligatorio = null;
    if (obligatorio === "true") obligatorio = true;
    if (obligatorio === "false") obligatorio = false;

    const whereClause = {};
    if (tipo_requerimiento) whereClause.tipo_requisito = tipo_requerimiento;
    if (obligatorio !== null) whereClause.obligatorio = obligatorio;

    const edicionCategoria = await EdicionCategoria.findByPk(
      idEdicionCategoria,
      {
        attributes: ["id_edicion_categoria"],
        include: [
          {
            model: RequisitosEdicionCategoria,
            as: "RequisitosEdicionCategoria",
            where: whereClause,
            required: false,
            attributes: [
              "id_requisito_edicion_categoria",
              "obligatorio",
              "tipo_requisito",
            ],
            include: [
              {
                model: Requisitos,
                attributes: ["id_requisito", "descripcion"],
              },
              {
                model: RequisitosCategoriaConfig,
                as: "RequisitosCategoriaConfig",
              },
            ],
          },
        ],
      },
    );

    const requisitosFormateados =
      edicionCategoria.RequisitosEdicionCategoria.map((req) => {
        const configs = req.RequisitosCategoriaConfig
          ? {
              id_config: req.RequisitosCategoriaConfig.id_config,
              id_requisito_edicion_categoria:
                req.RequisitosCategoriaConfig.id_requisito_edicion_categoria,
              extensiones_permitidas: req.RequisitosCategoriaConfig.extensione,
              tamano_max_mb: req.RequisitosCategoriaConfig.tamano_max,
              fecha_registro: req.RequisitosCategoriaConfig.fecha_regi,
              max_caracteres: req.RequisitosCategoriaConfig.max_caract,
            }
          : null;

        return {
          id_requisito_edicion_categoria: req.id_requisito_edicion_categoria,
          obligatorio: req.obligatorio,
          tipo_requisito: req.tipo_requisito,
          Requisito: req.Requisito,
          RequisitosCategoriaConfig: configs,
        };
      });

    return res.json({
      mensaje: "Requisitos filtrados correctamente",
      requisitosEdicionCategoria: requisitosFormateados,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const agregarRequisitoCategoriaEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_requisito, obligatorio, tipo, config } = req.body;
    const { id_edicion_categoria } = req.params;

    const existe_edicion = await RequisitosEdicion.findOne({
      where: {
        id_requisito: id_requisito,
      },
      transaction,
    });

    if (existe_edicion) {
      await transaction.rollback();
      return res.status(404).json({
        message:
          "No se puede agregar el requisito a la categoría. El requisito ya esta definido para la edición.",
      });
    }

    const existe_categoria_edicion = await RequisitosEdicionCategoria.findOne({
      where: {
        id_edicion_categoria: id_edicion_categoria,
        id_requisito: id_requisito,
        tipo_requisito: tipo,
      },
      transaction,
    });

    if (existe_categoria_edicion) {
      await transaction.rollback();
      return res.status(400).json({
        message: "El requisito ya está definido para la categoria",
      });
    }

    if (tipo === "documento") {
      if (!config?.extensiones_permitidas || !config?.tamano_max_mb) {
        throw new Error("Configuración de documento inválida");
      }
    }

    if (tipo === "texto") {
      if (!config?.max_caracteres) {
        throw new Error("Debe indicar el máximo de caracteres");
      }
    }

    const requisito = await RequisitosEdicionCategoria.create(
      {
        id_edicion_categoria: id_edicion_categoria,
        id_requisito: id_requisito,
        tipo_requisito: tipo,
        obligatorio: obligatorio,
      },
      { transaction },
    );

    const requisito_config = await RequisitosCategoriaConfig.create(
      {
        id_requisito_edicion_categoria:
          requisito.id_requisito_edicion_categoria,
        extensiones_permitidas:
          config.extensiones_permitidas?.join(",") || null,
        tamano_max_mb: config.tamano_max_mb || null,
        max_caracteres: config.max_caracteres || null,
      },
      { transaction },
    );

    await transaction.commit();

    res.status(201).json({
      message: "Requisito agregado a la categoría correctamente",
      requisito: requisito,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const editarConfiguracionRequisitoCategoriaEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_requisito_edicion_categoria } = req.params;
    const { tipo_requisito, config } = req.body;

    if (!id_requisito_edicion_categoria) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Falta el identificador de requisito en la categoría" });
    }

    const existe = await RequisitosEdicionCategoria.findByPk(
      id_requisito_edicion_categoria,
      { transaction },
    );

    if (!existe) {
      await transaction.rollback();
      return res.status(404).json({ error: "Requisito no encontrado" });
    }

    if (tipo_requisito === "documento") {
      if (!config?.extensiones_permitidas || !config?.tamano_max_mb) {
        throw new Error("Configuración de documento inválida");
      }
    }

    if (tipo_requisito === "texto") {
      if (!config?.max_caracteres) {
        throw new Error("Debe indicar el máximo de caracteres");
      }
    }

    await RequisitosCategoriaConfig.update(
      {
        extensiones_permitidas:
          config.extensiones_permitidas?.join(",") || null,
        tamano_max_mb: config.tamano_max_mb || null,
        max_caracteres: config.max_caracteres || null,
      },
      {
        where: {
          id_requisito_edicion_categoria: id_requisito_edicion_categoria,
        },
        transaction,
      },
    );

    const requisito = await RequisitosEdicionCategoria.findOne({
      where: { id_requisito_edicion_categoria: id_requisito_edicion_categoria },
      include: [
        {
          model: RequisitosCategoriaConfig,
          as: "RequisitosCategoriaConfig",
          required: true,
        },
        {
          model: Requisitos,
          as: "Requisito",
          required: true,
        },
      ],
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      message: "Requisito editado correctamente",
      requisito: requisito,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      error: error.message || "Error en el servidor",
    });
  }
};

const editarRequisitoCategoriaEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_requisito_edicion_categoria } = req.params;
    const { tipo_requisito, obligatorio, config } = req.body;

    if (!id_requisito_edicion_categoria) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Falta el identificador de requisito en la categoría" });
    }

    const existe = await RequisitosEdicionCategoria.findByPk(
      id_requisito_edicion_categoria,
      { transaction },
    );

    if (!existe) {
      await transaction.rollback();
      return res.status(404).json({ error: "Requisito no encontrado" });
    }

    await RequisitosEdicionCategoria.update(
      {
        tipo_requisito: tipo_requisito,
        obligatorio: obligatorio ? 1 : 0,
      },
      {
        where: {
          id_requisito_edicion_categoria: id_requisito_edicion_categoria,
        },
        transaction,
      },
    );

    const requisito = await RequisitosEdicionCategoria.findOne({
      where: { id_requisito_edicion_categoria: id_requisito_edicion_categoria },
      include: [
        {
          model: RequisitosCategoriaConfig,
          as: "RequisitosCategoriaConfig",
          required: true,
        },
        {
          model: Requisitos,
          as: "Requisito",
          required: true,
        },
      ],
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      message: "Requisito editado correctamente",
      requisito: requisito,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      error: error.message || "Error en el servidor",
    });
  }
};

const eliminarRequisitoCategoriaEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_requisito_edicion_categoria } = req.params;

    const existe = await RequisitosEdicionCategoria.findByPk(
      id_requisito_edicion_categoria,
      { transaction },
    );

    if (!existe) {
      await transaction.rollback();
      return res.status(404).json({ error: "Requisito no encontrado" });
    }

    const existe_config = await RequisitosCategoriaConfig.findOne({
      where: {
        id_requisito_edicion_categoria: id_requisito_edicion_categoria,
      },
      transaction,
    });

    if (!existe_config) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ error: "Configuración del requisito no encontrada" });
    }

    await existe.destroy({ transaction });
    await existe_config.destroy({ transaction });

    await transaction.commit();

    res.status(200).json({
      message: "Requisito eliminado correctamente",
      id_requisito_edicion_categoria,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      error: error.message || "Error en el servidor",
    });
  }
};

const editarRequisitoEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_requisito_edicion } = req.params;
    const { tipo_requisito, obligatorio, config } = req.body;

    if (!id_requisito_edicion) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Falta el identificador de requisito en la categoría" });
    }

    const existe = await RequisitosEdicion.findByPk(id_requisito_edicion, {
      transaction,
    });

    if (!existe) {
      await transaction.rollback();
      return res.status(404).json({ error: "Requisito no encontrado" });
    }

    await RequisitosEdicion.update(
      {
        tipo_requisito: tipo_requisito,
        obligatorio: obligatorio ? 1 : 0,
      },
      {
        where: {
          id_requisito_edicion: id_requisito_edicion,
        },
        transaction,
      },
    );

    const requisito = await RequisitosEdicion.findOne({
      where: { id_requisito_edicion: id_requisito_edicion },
      include: [
        {
          model: RequisitosConfig,
          as: "RequisitosConfig",
          required: true,
        },
        {
          model: Requisitos,
          as: "Requisito",
          required: true,
        },
      ],
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      message: "Requisito editado correctamente",
      requisito: requisito,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      error: error.message || "Error en el servidor",
    });
  }
};

const editarConfiguracionRequisitoEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_requisito_edicion } = req.params;
    const { tipo_requisito, config } = req.body;

    if (!id_requisito_edicion) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Falta el identificador de requisito en la edición" });
    }

    const existe = await RequisitosEdicion.findByPk(id_requisito_edicion, {
      transaction,
    });

    if (!existe) {
      await transaction.rollback();
      return res.status(404).json({ error: "Requisito no encontrado" });
    }

    if (tipo_requisito === "documento") {
      if (!config?.extensiones_permitidas || !config?.tamano_max_mb) {
        throw new Error("Configuración de documento inválida");
      }
    }

    if (tipo_requisito === "texto") {
      if (!config?.max_caracteres) {
        throw new Error("Debe indicar el máximo de caracteres");
      }
    }

    await RequisitosConfig.update(
      {
        extensiones_permitidas:
          config.extensiones_permitidas?.join(",") || null,
        tamano_max_mb: config.tamano_max_mb || null,
        max_caracteres: config.max_caracteres || null,
      },
      {
        where: {
          id_requisito_edicion: id_requisito_edicion,
        },
        transaction,
      },
    );

    const requisito = await RequisitosEdicion.findOne({
      where: { id_requisito_edicion: id_requisito_edicion },
      include: [
        {
          model: RequisitosConfig,
          as: "RequisitosConfig",
          required: true,
        },
        {
          model: Requisitos,
          as: "Requisito",
          required: true,
        },
      ],
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      message: "Requisito editado correctamente",
      requisito: requisito,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      error: error.message || "Error en el servidor",
    });
  }
};

const eliminarRequisitoEdicion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { id_requisito_edicion } = req.params;

    const existe = await RequisitosEdicion.findByPk(id_requisito_edicion, {
      transaction,
    });

    if (!existe) {
      await transaction.rollback();
      return res.status(404).json({ error: "Requisito no encontrado" });
    }

    const existe_config = await RequisitosConfig.findOne({
      where: {
        id_requisito_edicion: id_requisito_edicion,
      },
      transaction,
    });

    if (!existe_config) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ error: "Configuración del requisito no encontrada" });
    }

    await existe.destroy({ transaction });
    await existe_config.destroy({ transaction });

    await transaction.commit();

    res.status(200).json({
      message: "Requisito eliminado correctamente",
      id_requisito_edicion,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      error: error.message || "Error en el servidor",
    });
  }
};

module.exports = {
  listarRequisitosPorCategoriaEdicion,
  obtenerConfiguracionRequisitoDeCategoriaEdicion,
  listarRequisitosEdicion,
  listarRequisitosCategoriaEdicionInscripcion,
  listarRequisitosEdicionInscripcion,
  filtrarRequisitosEdicion,
  filtrarRequisitosCategoriaEdicion,
  crearRequisito,
  agregarRequisitoEdicion,
  agregarRequisitoCategoriaEdicion,
  editarRequisito,
  editarRequisitoCategoriaEdicion,
  eliminarRequisito,
  eliminarRequisitoCategoriaEdicion,
  editarConfiguracionRequisitoCategoriaEdicion,
  editarRequisitoEdicion,
  editarConfiguracionRequisitoEdicion,
  eliminarRequisitoEdicion
};

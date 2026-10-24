const jwt = require("jsonwebtoken");
const { Usuario, Rol, UsuarioRol, UsuarioToken } = require("../models");
const { setAuditContext } = require("../utils/audits");
const sequelize = require("../configs/db");
const { Op, where } = require("sequelize");
const { sendEmailCrearContrasena } = require("../configs/mail.config");

const listarDirectores = async (req, res) => {
  try {
    const {
      search = "",
      genero,
      nivel_estudio_superior,
      estado,
      page,
      limit,
    } = req.query;

    const queryOptions = {
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
        ...(genero && genero !== "TODOS" && { genero }),
        ...(nivel_estudio_superior &&
          nivel_estudio_superior !== "TODOS" && {
            nivel_estudio_superior,
          }),
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: {
            id_rol: 2,
          },
          through: {
            where: {
              ...(estado &&
                estado !== "TODOS" && {
                  estado_rol: estado,
                }),
            },
          },
        },
      ],
      distinct: true,
    };

    if (page && limit) {
      queryOptions.order = [["id_usuario", "ASC"]];
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Usuario.findAndCountAll(queryOptions);

    return res.json({
      message: "Directores obtenidos correctamente",
      directores: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.error("Error al obtener directores:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const agregarDirector = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;

    await setAuditContext(sequelize, req, transaction);

    const {
      numero_documento,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo_electronico,
      telefono,
      direccion,
      codigo_institucional,
      genero,
      nivel_estudio_superior,
      fecha_nacimiento,
    } = req.body;

    let usuario = await Usuario.findOne({
      where: { numero_documento },
      include: [
        {
          model: Rol,
          as: "roles",
        },
      ],
      transaction,
    });

    if (usuario) {
      if (
        usuario.roles?.some(
          (rol) => rol.id_rol === 2 && rol.UsuarioRol.estado_rol === "activo",
        )
      ) {
        await transaction.rollback();
        return res.status(400).json({
          message: "El usuario ya está registrado como director activo",
        });
      }
      if (
        usuario.roles?.some(
          (rol) => rol.id_rol === 2 && rol.UsuarioRol.estado_rol === "inactivo",
        )
      ) {
        await transaction.rollback();
        return res.status(400).json({
          message:
            "El usuario ya está registrado como director, pero su estado en el sistema es inactivo",
        });
      }

      await usuario.addRole(2, {
        through: { estado_rol: "activo" },
        transaction,
      });

      const usuario_director = await Usuario.findOne({
        where: {
          id_usuario: usuario.id_usuario,
        },
        attributes: [
          "id_usuario",
          "tipo_documento",
          "numero_documento",
          "primer_nombre",
          "segundo_nombre",
          "primer_apellido",
          "segundo_apellido",
          "correo_electronico",
          "fecha_nacimiento",
          "telefono",
          "genero",
          "direccion",
          "fecha_registro",
          "nivel_estudio_superior",
          "fecha_actualizacion",
          "codigo_institucional",
        ],
        include: [
          {
            model: Rol,
            as: "roles",
            where: {
              id_rol: 2,
            },
          },
        ],
        transaction,
      });

      await transaction.commit();

      return res.status(200).json({
        message: "Rol de director asignado correctamente al usuario existente",
        usuario: usuario_director,
      });
    }

    const correoExistente = await Usuario.findOne({
      where: { correo_electronico },
      transaction,
    });

    if (correoExistente) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "El correo electrónico ya está registrado" });
    }

    if (codigo_institucional) {
      const codigoExistente = await Usuario.findOne({
        where: { codigo_institucional },
        transaction,
      });

      if (codigoExistente) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ message: "El código institucional ya está registrado" });
      }
    }

    const telefonoExistente = await Usuario.findOne({
      where: { telefono },
      transaction,
    });

    if (telefonoExistente) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "El número de teléfono ya está registrado" });
    }

    const nuevoUsuario = await Usuario.create(
      {
        tipo_documento: "CC",
        numero_documento,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        correo_electronico,
        telefono,
        direccion,
        genero,
        fecha_nacimiento,
        nivel_estudio_superior,
        codigo_institucional,
        estado: "inactivo",
        contrasena: "contra_prueba",
        fecha_registro: new Date(),
        creo_contrasena: false,
      },
      { transaction },
    );

    await nuevoUsuario.addRole(2, {
      through: { estado_rol: "inactivo" },
      transaction,
    });

    const director = await Usuario.findOne({
      where: {
        id_usuario: nuevoUsuario.id_usuario,
      },
      attributes: [
        "id_usuario",
        "tipo_documento",
        "numero_documento",
        "primer_nombre",
        "segundo_nombre",
        "primer_apellido",
        "segundo_apellido",
        "correo_electronico",
        "fecha_nacimiento",
        "telefono",
        "genero",
        "direccion",
        "fecha_registro",
        "nivel_estudio_superior",
        "fecha_actualizacion",
        "codigo_institucional",
      ],
      include: [
        {
          model: Rol,
          as: "roles",
          where: {
            id_rol: 2,
          },
        },
      ],
      transaction,
    });

    const tokenCreacion = jwt.sign(
      { id_usuario: director.id_usuario, id_rol: 2 },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    await UsuarioToken.create(
      {
        id_usuario: nuevoUsuario.id_usuario,
        token: tokenCreacion,
        usado: false,
        fecha_creacion: new Date(),
        fecha_expiracion: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { transaction },
    );

    const enlaceCreacion = `${process.env.FRONTEND_URL}/crear-clave/${tokenCreacion}`;

    await sendEmailCrearContrasena(
      nuevoUsuario.correo_electronico,
      nuevoUsuario.primer_nombre,
      enlaceCreacion,
    );
    await transaction.commit();
    return res.status(201).json({
      message:
        "Usuario registrado correctamente y rol director asignado. Se envió un correo para que cree su contraseña.",
      usuario: director,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error al agregar director:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const editarInformacionDirector = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;

    await setAuditContext(sequelize, req, transaction);
    const { numero_documento } = req.params;
    const {
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo_electronico,
      telefono,
      direccion,
      codigo_institucional,
      genero,
      nivel_estudio_superior,
      fecha_nacimiento,
    } = req.body;

    const usuario = await Usuario.findOne({
      where: { numero_documento },
      transaction,
    });

    if (!usuario) {
      await transaction.rollback();
      return res.status(404).json({ message: "Director no encontrado" });
    }

    const cambios = {
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo_electronico,
      telefono,
      direccion,
      codigo_institucional,
      genero,
      nivel_estudio_superior,
      fecha_nacimiento,
    };

    const sinCambios = Object.keys(cambios).every((key) => {
      if (key === "fecha_nacimiento") {
        const fechaOriginal = usuario.fecha_nacimiento
          ? new Date(usuario.fecha_nacimiento).toISOString().split("T")[0]
          : null;
        const fechaNueva = cambios.fecha_nacimiento
          ? new Date(cambios.fecha_nacimiento).toISOString().split("T")[0]
          : null;
        return fechaOriginal === fechaNueva;
      }
      return usuario[key] === cambios[key];
    });

    const existente = await Usuario.findOne({
      where: {
        id_usuario: {
          [Op.ne]: usuario.id_usuario,
        },

        [Op.or]: [
          {
            correo_electronico: cambios.correo_electronico,
          },
          {
            telefono: cambios.telefono,
          },
        ],
      },

      transaction,
    });

    if (existente) {
      return res.status(400).json({
        message:
          "No se puede editar. Datos de contacto ya existentes en el sistema",
      });
    }

    if (sinCambios) {
      await transaction.rollback();
      return res.status(201).json({
        message: "No realizaste cambios al director",
        jurado,
        status: 201,
      });
    }

    await usuario.update(
      {
        ...cambios,
        fecha_actualizacion: new Date(),
      },
      { transaction },
    );

    const directorActualizado = await Usuario.findOne({
      where: {
        id_usuario: usuario.id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 2 },
          attributes: ["id_rol", "nombre_rol"],
          through: {
            model: UsuarioRol,
            attributes: ["estado_rol", "fecha_registro", "fecha_actualizacion"],
          },
        },
      ],
      transaction,
    });

    await transaction.commit();
    return res.status(200).json({
      message: "Información del director actualizada correctamente",
      director: directorActualizado,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error al editar información del director:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const cambiarEstadoDirector = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id_usuario, estado } = req.body.datos;

    req.audit.usuario_id = req.user.data.id_usuario;

    if (estado === "activo") {
      req.audit.metodo = "ACTIVATE";
    } else if (estado === "inactivo") {
      req.audit.metodo = "INACTIVE";
    } else {
      req.audit.metodo = "CHANGE_STATE";
    }

    await setAuditContext(sequelize, req, transaction);

    const director = await Usuario.findOne({
      where: {
        id_usuario: id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 2 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
      transaction,
    });

    if (!director) {
      return res.status(404).json({ message: "Director no encontrado" });
    }

    if (estado === "activo") {
      await UsuarioRol.update(
        {
          estado_rol: "activo",
          fecha_actualizacion: new Date(),
        },
        {
          where: {
            id_usuario: director.id_usuario,
            id_rol: 2,
          },
          transaction,
        },
      );
    } else {
      await UsuarioRol.update(
        {
          estado_rol: "inactivo",
          fecha_actualizacion: new Date(),
        },
        {
          where: {
            id_usuario: director.id_usuario,
            id_rol: 2,
          },
          transaction,
        },
      );
    }

    const directorActualizado = await Usuario.findOne({
      where: {
        id_usuario: director.id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 2 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      message: "Estado del director actualizado correctamente",
      director: directorActualizado,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error al cambiar estado de director:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

const obtenerDirector = async (req, res) => {
  try {
    const { id_usuario } = req.params;

    const director = await Usuario.findOne({
      where: {
        id_usuario,
      },
      include: [
        {
          model: Rol,
          as: "roles",
          where: { id_rol: 2 },
          through: {
            model: UsuarioRol,
          },
        },
      ],
    });

    return res.json({
      message: "director obtenido correctamente",
      director,
    });
  } catch (error) {
    console.error("Error al obtener director:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

module.exports = {
  listarDirectores,
  agregarDirector,
  editarInformacionDirector,
  cambiarEstadoDirector,
  obtenerDirector,
};

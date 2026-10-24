const { getToken, generateRefreshToken } = require("../configs/jwt.config");
const jwt = require("jsonwebtoken");
const {
  Usuario,
  Rol,
  Participacion,
  Edicion,
  EdicionCategoria,
  Categoria,
  Sesion,
} = require("../models");
const sequelize = require("../configs/db");
const { Op, where } = require("sequelize");

const editarInformacionContacto = async (req, res) => {
  try {
    const { correo, telefono, direccion } = req.body;

    // Cada usuario solo puede editar su propia información de contacto
    const id_usuario = req.user.data.id_usuario;

    if (Number(req.params.id_usuario) !== id_usuario) {
      return res.status(403).json({
        message: "No puedes modificar la información de otro usuario",
      });
    }

    const usuario = await Usuario.findOne({
      where: { id_usuario: id_usuario },
      include: [
        {
          model: Rol,
          as: "roles",
          through: {
            where: { estado_rol: "activo" },
          },
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (correo && correo !== usuario.correo_electronico) {
      const existeCorreo = await Usuario.findOne({
        where: { correo_electronico: correo },
      });

      if (existeCorreo && existeCorreo.id_usuario !== id_usuario) {
        return res.status(400).json({
          message: "El correo ya está en uso por otro usuario",
        });
      }
    }

    if (telefono && telefono !== usuario.telefono) {
      const existeTelefono = await Usuario.findOne({
        where: { telefono: telefono },
      });

      if (existeTelefono && existeTelefono.id_usuario !== id_usuario) {
        return res.status(400).json({
          message: "El número de teléfono ya está en uso por otro usuario",
        });
      }
    }

    if (direccion && direccion !== usuario.direccion) {
      const existeDireccion = await Usuario.findOne({
        where: { direccion: direccion },
      });

      if (existeDireccion && existeDireccion.id_usuario !== id_usuario) {
        return res.status(400).json({
          message: "La dirección ya está en uso por otro usuario",
        });
      }
    }

    // Solo se actualizan los campos enviados, para no borrar los demás
    if (correo !== undefined) usuario.correo_electronico = correo;
    if (telefono !== undefined) usuario.telefono = telefono;
    if (direccion !== undefined) usuario.direccion = direccion;
    usuario.fecha_actualizacion = new Date();

    await usuario.save();

    res.json({ message: "Datos actualizados correctamente", usuario });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const cambiarRolActivo = async (req, res) => {
  try {
    const { nuevoRol } = req.body;

    // El cambio de rol solo aplica al usuario de la sesión actual
    const id_usuario = req.user.data.id_usuario;

    if (Number(req.params.id_usuario) !== id_usuario) {
      return res.status(403).json({
        message: "No puedes cambiar el rol de otro usuario",
      });
    }

    const usuario = await Usuario.findOne({
      where: { id_usuario: id_usuario },
      include: [
        {
          model: Rol,
          as: "roles",
          through: {
            where: { estado_rol: "activo" },
          },
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!usuario.roles.find((rol) => rol.id_rol === nuevoRol)) {
      return res.status(404).json({ message: "Rol no asociado al usuario" });
    }

    const payload = {
      id_usuario: usuario.id_usuario,
      tipo_documento: usuario.tipo_documento,
      numero_documento: usuario.numero_documento,
      primer_nombre: usuario.primer_nombre,
      segundo_nombre: usuario.segundo_nombre,
      primer_apellido: usuario.primer_apellido,
      segundo_apellido: usuario.segundo_apellido,
      correo: usuario.correo_electronico,
      fecha_nacimiento: usuario.fecha_nacimiento,
      telefono: usuario.telefono,
      codigo_institucional: usuario.codigo_institucional,
      genero: usuario.genero,
      nivel_educativo: usuario.nivel_estudio_superior,
      fecha_registro: usuario.fecha_registro,
      direccion: usuario.direccion,
      fecha_actualizacion: usuario.fecha_actualizacion,
      rol_activo: usuario.roles.find((rol) => rol.id_rol === nuevoRol),
      roles: usuario.roles,
    };

    const { token: accessToken, expiresIn } = getToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await Sesion.upsert({
      id_usuario: usuario.id_usuario,
      token: accessToken,
      fecha_creacion: new Date(),
      fecha_expiracion: new Date(Date.now() + expiresIn * 1000),
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 60 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });

    res.json({
      message: "Cambio de Rol Exitoso",
      usuario: payload,
      expiresIn,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerUsuarioPorCedula = async (req, res) => {
  try {
    const { numero_documento } = req.params;

    const usuario = await Usuario.findOne({
      where: { numero_documento },
      attributes: [
        "tipo_documento",
        "numero_documento",
        "primer_nombre",
        "segundo_nombre",
        "primer_apellido",
        "segundo_apellido",
        "correo_electronico",
        "telefono",
        "direccion",
        "genero",
        "fecha_nacimiento",
        "codigo_institucional",
        "nivel_estudio_superior",
      ],
    });

    if (!usuario) {
      return res.json({ exists: false, usuario });
    }

    return res.json({ exists: true, usuario });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error interno" });
  }
};

const obtenerUsuarioPorCedulaInscripcion = async (req, res) => {
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

    const { idEdicion } = req.query;

    if (Number(idEdicion) !== Number(decoded.id_edicion)) {
      return res.status(403).json({
        message: "El token no corresponde a esta edición",
      });
    }
    const { numero_documento } = req.params;

    const usuario = await Usuario.findOne({
      where: { numero_documento },
      attributes: [
        "tipo_documento",
        "numero_documento",
        "primer_nombre",
        "segundo_nombre",
        "primer_apellido",
        "segundo_apellido",
        "correo_electronico",
        "telefono",
        "direccion",
        "genero",
        "fecha_nacimiento",
        "codigo_institucional",
        "nivel_estudio_superior",
      ],
    });

    if (!usuario) {
      return res.json({ exists: false, usuario });
    }

    return res.json({ exists: true, usuario });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error interno" });
  }
};

const listarGanadoresEdicion = async (req, res) => {
  try {
    const { id_edicion } = req.params;
    const { search = "", genero, categoria, page, limit } = req.query;

    const queryOptions = {
      include: [
        {
          model: Usuario,
          as: "usuario",
          required: true,
          where: {
            ...(search && {
              [Op.or]: [
                { numero_documento: { [Op.iLike]: `%${search}%` } },
                { primer_nombre: { [Op.iLike]: `%${search}%` } },
                { segundo_nombre: { [Op.iLike]: `%${search}%` } },
                { primer_apellido: { [Op.iLike]: `%${search}%` } },
                { segundo_apellido: { [Op.iLike]: `%${search}%` } },
              ],
            }),
            ...(genero && genero !== "TODOS" && { genero }),
          },
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          where: {
            ...(categoria &&
              categoria !== "TODOS" && { id_edicion_categoria: categoria }),
          },
          include: [
            {
              model: Categoria,
              as: "categoria",
            },
          ],
        },
      ],
      distinct: true,
      subQuery: false,
    };

    if (page && limit) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = (parseInt(page) - 1) * parseInt(limit);
    }

    const { count, rows } = await Participacion.findAndCountAll({
      where: { id_edicion: id_edicion, puesto: { [Op.ne]: null } },
      ...queryOptions,
    });

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        message: "No hay ganadores registrados para esta edición",
        ganadores: [],
        pagination: {
          total: 0,
          page: 1,
          totalPages: 1,
          limit: 0,
        },
      });
    }

    return res.json({
      message: "Gandores obtenidos correctamente",
      ganadores: rows,
      pagination: {
        total: count,
        page: page ? parseInt(page) : 1,
        totalPages: limit ? Math.ceil(count / limit) : 1,
        limit: limit ? parseInt(limit) : count,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error interno" });
  }
};

const filtrarGanadoresEdicion = async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const { idEdicion } = req.params;
    const { genero } = req.query;
    const id_edicion_categoria = req.query.categoria;

    const whereClause = {
      id_edicion: idEdicion,
      es_ganador: true,
    };

    const whereClauseUser = {};

    const whereClauseCategoria = {};

    if (genero && genero !== "TODOS") {
      whereClauseUser.genero = genero;
    }

    if (id_edicion_categoria && id_edicion_categoria !== "TODOS") {
      whereClauseCategoria.id_edicion_categoria = id_edicion_categoria;
    }

    const ganadores = await Participacion.findAll({
      where: whereClause,
      attributes: [
        "id_participacion",
        "estado",
        "fecha_postulacion",
        "fecha_revision",
        "observacion",
        "comentarios",
        "calificacion_final",
        "fecha_resultados",
        "es_ganador",
        "puesto",
      ],
      include: [
        {
          model: Usuario,
          as: "usuario",
          where: whereClauseUser,
          attributes: [
            "id_usuario",
            "tipo_documento",
            "numero_documento",
            "primer_nombre",
            "segundo_nombre",
            "primer_apellido",
            "segundo_apellido",
            "correo_electronico",
            "telefono",
            "direccion",
            "genero",
            "fecha_nacimiento",
            "codigo_institucional",
            "nivel_estudio_superior",
          ],
        },
        {
          model: EdicionCategoria,
          as: "edicionCategoria",
          where: whereClauseCategoria,
          attributes: [
            "id_edicion_categoria",
            "descripcion",
            "numero_ganadores",
          ],
          include: [
            {
              model: Categoria,
              as: "categoria",
              attributes: ["id_categoria", "nombre_categoria"],
            },
          ],
        },
      ],
    });

    return res.json({
      mensaje: "Ganadores obtenidos correctamente",
      ganadores,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error interno" });
  }
};

module.exports = {
  editarInformacionContacto,
  cambiarRolActivo,
  obtenerUsuarioPorCedula,
  obtenerUsuarioPorCedulaInscripcion,
  listarGanadoresEdicion,
  filtrarGanadoresEdicion
};

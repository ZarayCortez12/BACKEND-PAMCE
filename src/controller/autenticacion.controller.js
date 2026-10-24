const bcrypt = require("bcrypt");
const {
  getToken,
  generateRefreshToken,
  getTokenData,
} = require("../configs/jwt.config");
const generateOTP = require("../utils/generarOTP");
const {
  sendEmailReset,
  sendEmailConvocatoria,
} = require("../configs/mail.config");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const {
  Usuario,
  Sesion,
  Rol,
  UsuarioRol,
  CodigoRecuperacion,
  Edicion,
  BloqueoUsuario,
  UsuarioToken,
  Convocatoria,
} = require("../models");
const sequelize = require("../configs/db");
const { de } = require("zod/v4/locales");
const { setAuditContext } = require("../utils/audits");

admin.initializeApp({
  credential: admin.credential.cert(require("../utils/serviceAccountKey.json")),
});

const login = async (req, res) => {
  try {
    const { numero_documento, clave } = req.body;

    const usuario = await Usuario.scope("conContrasena").findOne({
      where: { numero_documento },
      include: [
        {
          model: Rol,
          as: "roles",
          through: {
            where: { estado_rol: "activo" },
          },
        },
        {
          model: BloqueoUsuario,
          as: "bloqueo",
          attributes: ["id_usuario", "intentos_fallidos", "bloqueado_hasta"],
        },
      ],
    });

    if (!usuario) {
      return res
        .status(404)
        .json({ message: "Usuario no registrado en el sistema" });
    }

    if (!usuario.roles?.length) {
      return res.status(403).json({
        message: "Usuario sin roles activos. No puede acceder",
      });
    }

    if (usuario.bloqueo && usuario.bloqueo.bloqueado_hasta) {
      if (usuario.bloqueo.bloqueado_hasta > new Date()) {
        return res.status(403).json({
          message: `Usuario bloqueado. Intente nuevamente en ${Math.ceil((usuario.bloqueo.bloqueado_hasta - new Date()) / (1000 * 60))} minuto(s).`,
        });
      } else {
        await usuario.bloqueo.update({
          intentos_fallidos: 0,
          bloqueado_hasta: null,
          fecha_actualizacion: new Date(),
        });
      }
    }

    if (!(await bcrypt.compare(clave, usuario.contrasena))) {
      let intentos = 1;

      if (usuario.bloqueo) {
        intentos = usuario.bloqueo.intentos_fallidos + 1;

        if (intentos >= 3) {
          await usuario.bloqueo.update({
            intentos_fallidos: intentos,
            bloqueado_hasta: new Date(Date.now() + 10 * 60 * 1000),
            fecha_actualizacion: new Date(),
          });

          return res.status(403).json({
            message:
              "Has excedido el número de intentos. Usuario bloqueado por 10 minutos.",
          });
        } else {
          await usuario.bloqueo.update({
            intentos_fallidos: intentos,
            fecha_actualizacion: new Date(),
          });
        }
      } else {
        await BloqueoUsuario.create({
          id_usuario: usuario.id_usuario,
          intentos_fallidos: 1,
          bloqueado_hasta: null,
        });
      }

      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    if (usuario.bloqueo) {
      await usuario.bloqueo.update({
        intentos_fallidos: 0,
        bloqueado_hasta: null,
        fecha_actualizacion: new Date(),
      });
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
      rol_activo: usuario.roles[0],
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
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Inicio de sesión exitoso",
      usuario: payload,
      expiresIn,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "Error en el inicio de sesión. Intenta más tarde" });
  }
};

const loginGoogle = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token no enviado" });

    const decodedToken = await admin.auth().verifyIdToken(token);

    const usuario = await Usuario.findOne({
      where: { correo_electronico: decodedToken.email },
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
      return res
        .status(404)
        .json({ message: "Usuario no registrado en el sistema" });
    }

    if (!usuario.roles?.length) {
      return res.status(403).json({
        message: "Usuario sin roles activos. No puede acceder",
      });
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
      rol_activo: usuario.roles[0],
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
      message: "Inicio de sesión exitoso",
      usuario: payload,
      expiresIn,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Error en el inicio de sesión. Intenta más tarde" });
  }
};

const sendCodigo = async (req, res) => {
  try {
    const { correo_electronico } = req.body;

    if (!correo_electronico) {
      return res
        .status(400)
        .json({ message: "Correo electrónico es requerido" });
    }

    const usuario = await Usuario.findOne({
      where: { correo_electronico: correo_electronico },
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
      return res.status(404).json({ message: "Usuario no registrado" });
    }

    if (!usuario.roles?.length) {
      return res.status(403).json({
        message: "Usuario sin roles activos. No puede acceder",
      });
    }

    const codigoExistente = await CodigoRecuperacion.findOne({
      where: { id_usuario: usuario.id_usuario },
    });

    const ahora = new Date();

    if (
      codigoExistente &&
      !codigoExistente.usado &&
      codigoExistente.fecha_expiracion > ahora
    ) {
      return res.status(400).json({
        error:
          "Ya hay un código activo. Revise su correo o espere a que expire.",
      });
    }

    if (codigoExistente) {
      await codigoExistente.destroy();
    }

    const codigo = generateOTP();

    await CodigoRecuperacion.create({
      id_usuario: usuario.id_usuario,
      codigo,
      fecha_creacion: ahora,
      fecha_expiracion: new Date(ahora.getTime() + 3 * 60 * 1000),
      usado: false,
    });

    const nombre = `${usuario.primer_nombre} ${usuario.segundo_nombre || ""}`;

    await sendEmailReset(usuario.correo_electronico, codigo, nombre);

    return res.json({
      message: "Código de recuperación enviado al correo",
      correo_electronico: usuario.correo_electronico,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const validarCodigoOTP = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { correo_electronico, codigo } = req.body;

    if (!correo_electronico || !codigo) {
      return res.status(400).json({
        message: "Correo y código son requeridos",
      });
    }

    const ahora = new Date();

    const codigoOTP = await CodigoRecuperacion.findOne({
      where: { codigo },
      include: [
        {
          model: Usuario,
          as: "usuario",
          where: { correo_electronico },
        },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!codigoOTP) {
      await t.rollback();
      return res.status(404).json({
        message: "Código inválido",
      });
    }

    if (codigoOTP.usado) {
      await t.rollback();
      return res.status(400).json({
        message: "Código ya utilizado",
      });
    }

    if (ahora > codigoOTP.fecha_expiracion) {
      await t.rollback();
      return res.status(400).json({
        message: "Código expirado",
      });
    }

    codigoOTP.usado = true;
    await codigoOTP.save({ transaction: t });

    const token = jwt.sign(
      { id_usuario: codigoOTP.usuario.id_usuario },
      process.env.JWT_SECRET,
      { expiresIn: "5m" },
    );

    await UsuarioToken.create(
      {
        id_usuario: codigoOTP.usuario.id_usuario,
        token,
        usado: false,
        fecha_expiracion: new Date(ahora.getTime() + 5 * 60 * 1000),
        fecha_creacion: ahora,
      },
      { transaction: t },
    );

    await t.commit();

    return res.json({
      message: "Código válido",
      token: token,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
};

const reestablecerContraseña = async (req, res) => {
  try {
    const { correo, nueva_clave, token } = req.body;

    const usuario = await Usuario.findOne({
      where: { correo_electronico: correo },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const usuarioToken = await UsuarioToken.findOne({
      where: {
        id_usuario: usuario.id_usuario,
        token: token,
        fecha_expiracion: { [Op.gt]: new Date() },
      },
    });

    if (!usuarioToken) {
      return res.status(400).json({ error: "Token inválido o expirado" });
    }

    const salt = await bcrypt.genSalt(10);
    usuario.contrasena = await bcrypt.hash(nueva_clave, salt);
    usuario.fecha_actualizacion = new Date();

    await usuario.save();

    await UsuarioToken.destroy({ where: { id_token: usuarioToken.id_token } });

    res.json({ message: "Contraseña restablecida correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const obtenerUsuarioActual = async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "token expirado",
          code: "TOKEN_EXPIRED",
        });
      }

      return res.status(401).json({ message: "Token inválido" });
    }

    const sesion = await Sesion.findOne({
      where: {
        id_usuario: decoded.data.id_usuario,
        token: accessToken,
      },
    });

    if (!sesion) {
      return res.status(401).json({
        message: "Sesión inválida o cerrada",
      });
    }

    const usuario = await Usuario.findOne({
      where: { id_usuario: sesion.id_usuario },
      attributes: { exclude: ["contrasena"] },
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

    return res.json({
      usuario: {
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
        rol_activo: decoded.data.rol_activo,
        roles: decoded.data.roles,
      },
      expiresIn: decoded.exp * 1000,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error del servidor" });
  }
};

const refreshAccessToken = async (req, res) => {
  const { id_rol } = req.body;

  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      message: "No hay refresh token",
    });
  }

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, async (err, payload) => {
    if (err) {
      return res.status(403).json({
        message: "Refresh inválido",
      });
    }

    const usuarioRefresh = payload.data;

    try {
      const usuario = await Usuario.findOne({
        where: {
          id_usuario: usuarioRefresh.id_usuario,
        },
        include: [
          {
            model: Rol,
            as: "roles",
            through: {
              where: {
                estado_rol: "activo",
              },
            },
          },
        ],
      });

      if (!usuario) {
        return res.status(404).json({
          message: "Usuario no encontrado",
        });
      }

      const rolActivo = usuario.roles.find(
        (rol) => rol.id_rol === Number(id_rol),
      );

      if (!rolActivo) {
        return res.status(403).json({
          message: "El usuario no tiene este rol activo",
        });
      }

      const payloadData = {
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
        rol_activo: rolActivo,
        roles: usuario.roles,
      };

      const { token: accessToken, expiresIn } = getToken(payloadData);

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

      return res.json({
        message: "Sesión extendida correctamente",
        usuario: payloadData,
        expiresIn,
      });
    } catch (error) {
      console.error("Error refrescando token:", error);

      return res.status(500).json({
        message: "Error al refrescar sesión",
      });
    }
  });
};

const logout = (req, res) => {
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    });

    return res.json({ message: "Sesión cerrada correctamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al cerrar sesión" });
  }
};

const enviarCorreosConvocatoria = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    req.audit.usuario_id = req.user.data.id_usuario;
    await setAuditContext(sequelize, req, transaction);

    const { listaCorreos, id_edicion } = req.body;

    if (
      !listaCorreos ||
      !Array.isArray(listaCorreos) ||
      listaCorreos.length === 0
    ) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Debe proporcionar al menos un correo electrónico válido.",
      });
    }

    const edicion = await Edicion.findByPk(id_edicion, { transaction });

    if (!edicion) {
      await transaction.rollback();
      return res.status(404).json({ error: "Edición no encontrada" });
    }

    const nombreEdicion = edicion.nombre_edicion;

    for (const correo of listaCorreos) {
      try {
        const [anio, mes, dia] = edicion.fecha_fin_convocatoria
          .split("-")
          .map(Number);

        const fechaFin = new Date(Date.UTC(anio, mes - 1, dia + 1, 5, 0, 0));

        const exp = Math.floor(fechaFin.getTime() / 1000);

        const tokenEdicion = jwt.sign(
          {
            id_edicion,
            tipo: "convocatoria",
            exp,
          },
          process.env.JWT_SECRET,
        );

        const envio = await sendEmailConvocatoria(
          correo,
          nombreEdicion,
          tokenEdicion,
        );

        if (envio) {
          const convocatoria = await Convocatoria.findOne({
            where: {
              correo_electronico: correo,
              id_edicion,
            },
            transaction,
          });

          if (!convocatoria) {
            await Convocatoria.create(
              {
                id_edicion,
                correo_electronico: correo,
                estado_envio: "enviado",
                fecha_envio: new Date(),
                fecha_ultimo_envio: new Date(),
                intentos_envio: 1,
              },
              { transaction },
            );
          } else {
            await convocatoria.update(
              {
                fecha_ultimo_envio: new Date(),
                intentos_envio: convocatoria.intentos_envio + 1,
              },
              { transaction },
            );
          }
        }
      } catch (error) {
        console.error(`Error al enviar correo a ${correo}:`, error.message);
      }
    }

    await transaction.commit();

    res.status(200).json({
      message: "Correos enviados correctamente.",
      edicion: nombreEdicion,
      totalEnviados: listaCorreos.length,
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ error: "Error en el servidor" });
    console.error(error);
  }
};

const crearContrasena = async (req, res) => {
  try {
    const { token, clave } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token no proporcionado" });
    }

    let decoded;
    try {
      decoded = await getTokenData(token);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "El token para crear la contraseña ha expirado",
        });
      }
      return res.status(401).json({
        message: "Token inválido",
      });
    }
    const id_usuario = decoded.id_usuario;
    const id_rol = decoded.id_rol;

    const usuario = await Usuario.findOne({
      where: { id_usuario },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const usuarioRol = await UsuarioRol.findOne({
      where: { id_usuario, id_rol },
    });

    const tokenCreacion = await UsuarioToken.findOne({
      where: {
        id_usuario,
        token,
        fecha_expiracion: { [Op.gt]: new Date() },
      },
    });

    if (!tokenCreacion) {
      return res
        .status(401)
        .json({ message: "Token no encontrado o expirado" });
    }

    if (tokenCreacion.usado) {
      return res.status(400).json({ message: "El token ya fue usado" });
    }

    if (usuario.creo_contrasena) {
      return res.status(400).json({
        message: "El usuario ya creó su contraseña",
      });
    }

    const salt = await bcrypt.genSalt(10);
    usuario.contrasena = await bcrypt.hash(clave, salt);
    usuario.creo_contrasena = true;
    usuario.fecha_actualizacion = new Date();

    tokenCreacion.usado = true;
    usuarioRol.estado_rol = "activo";

    await usuario.save();
    await tokenCreacion.save();
    await usuarioRol.save();

    res.json({ message: "Contraseña creada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

const reenviarTokenCrearContrasena = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token no proporcionado" });
    }
    let decoded;
    try {
      decoded = await getTokenData(token);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "El token para reenviar la contraseña ha expirado",
        });
      }
      return res.status(401).json({
        message: "Token inválido",
      });
    }

    const tokenCreacion = await UsuarioToken.findOne({
      where: {
        id_usuario: decoded.id_usuario,
        tipo_token: "CREACION_CLAVE",
      },
    });

    if (!tokenCreacion) {
      return res.status(401).json({ message: "Token no encontrado" });
    }

    if (tokenCreacion.usado) {
      return res.status(400).json({ message: "El token ya fue usado" });
    }

    if (new Date() < tokenCreacion.fecha_expiracion) {
      return res.status(400).json({
        message: "El token no ha expirado. No puedes volver a enviarlo",
      });
    }

    const usuario = await Usuario.findOne({
      where: { id_usuario: decoded.id_usuario },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (usuario.creo_contrasena) {
      return res.status(400).json({
        message:
          "El usuario ya creó su contraseña. No puedes volver a enviarlo",
      });
    }

    const tokenCreacionContrasena = jwt.sign(
      { id_usuario: decoded.id_usuario, id_rol: decoded.id_rol },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    const enlaceCreacion = `${process.env.FRONTEND_URL}/crear-clave/${tokenCreacionContrasena}`;

    await sendEmailCrearContrasena(
      usuario.correo_electronico,
      usuario.primer_nombre,
      enlaceCreacion,
    );

    return res.status(200).json({
      message: "Enlace para crear contraseña enviado correctamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

module.exports = {
  login,
  sendCodigo,
  enviarCorreosConvocatoria,
  validarCodigoOTP,
  reestablecerContraseña,
  obtenerUsuarioActual,
  refreshAccessToken,
  loginGoogle,
  logout,
  crearContrasena,
  reenviarTokenCrearContrasena,
};

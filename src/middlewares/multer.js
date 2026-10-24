const multer = require("multer");
const path = require("path");
const fs = require("fs");

const CARPETA_DOCUMENTOS = path.resolve(__dirname, "..", "documentos");

// Mismas extensiones que el director puede configurar en los requisitos
const EXTENSIONES_PERMITIDAS = [".pdf", ".docx", ".xlsx", ".jpg", ".jpeg", ".png"];

// Los campos de archivo deben ser requisitos_edicion_documentos[ID]
// o requisitos_categoria_documentos[ID]
const CAMPO_DOCUMENTO = /^requisitos_(edicion|categoria)_documentos\[\d+\]$/;

// Convierte un texto del formulario en un nombre de carpeta seguro:
// sin separadores de ruta, sin ".." y sin caracteres de control
const nombreCarpetaSeguro = (valor) =>
  String(valor ?? "")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "")
    .replace(/\.{2,}/g, "")
    .trim()
    .slice(0, 100);

// Los nombres de carpeta salen de la base de datos (no del formulario),
// usando la edición validada por validarAccesoConvocatoria
const obtenerCarpetaPostulacion = async (req) => {
  if (req.carpetaPostulacion) return req.carpetaPostulacion;

  const { Edicion, EdicionCategoria, Categoria, Usuario } = require("../models");

  const [edicion, edicionCategoria, usuario] = await Promise.all([
    Edicion.findByPk(req.query.id_edicion),
    EdicionCategoria.findOne({
      where: {
        id_edicion_categoria: req.body.id_edicion_categoria,
        id_edicion: req.query.id_edicion,
      },
      include: [{ model: Categoria, as: "categoria" }],
    }),
    Usuario.findByPk(req.body.id_usuario),
  ]);

  if (!edicion || !edicionCategoria?.categoria || !usuario) return null;

  req.carpetaPostulacion = {
    nombreEdicion: nombreCarpetaSeguro(edicion.nombre_edicion.toUpperCase()),
    nombreCategoria: nombreCarpetaSeguro(
      edicionCategoria.categoria.nombre_categoria.toUpperCase(),
    ),
    numeroDocumento: String(usuario.numero_documento),
  };

  return req.carpetaPostulacion;
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    let carpeta;
    try {
      carpeta = await obtenerCarpetaPostulacion(req);
    } catch (error) {
      return cb(error);
    }

    if (
      !carpeta ||
      !carpeta.nombreEdicion ||
      !carpeta.nombreCategoria ||
      !/^[A-Za-z0-9]{3,20}$/.test(carpeta.numeroDocumento)
    ) {
      return cb(
        new multer.MulterError(
          "LIMIT_UNEXPECTED_FILE",
          "Faltan o son inválidos los datos de la edición, la categoría o el participante.",
        ),
      );
    }

    const { nombreEdicion, nombreCategoria, numeroDocumento } = carpeta;

    const basePath = path.resolve(
      CARPETA_DOCUMENTOS,
      nombreEdicion,
      nombreCategoria,
      `PARTICIPACION_USUARIO_${numeroDocumento}`,
    );

    // Defensa adicional: la carpeta final siempre debe quedar dentro de documentos
    if (!basePath.startsWith(CARPETA_DOCUMENTOS + path.sep)) {
      return cb(
        new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Ruta de archivo inválida."),
      );
    }

    fs.mkdirSync(basePath, { recursive: true });

    cb(null, basePath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = file.fieldname.replace(/\[|\]/g, "_");

    cb(null, `${cleanName}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!CAMPO_DOCUMENTO.test(file.fieldname)) {
    return cb(
      new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Campo de archivo no permitido."),
    );
  }

  const extension = path.extname(file.originalname).toLowerCase();

  if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
    return cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `Tipo de archivo no permitido. Usa: ${EXTENSIONES_PERMITIDAS.join(", ")}`,
      ),
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 30,
  },
});

// Igual que upload.any, pero devuelve los errores de multer como 400
// con un mensaje claro en lugar de dejarlos sin manejar
upload.anyConManejo = () => (req, res, next) =>
  upload.any()(req, res, (error) => {
    if (!error) return next();

    let message = error.field || error.message;
    if (error.code === "LIMIT_FILE_SIZE") {
      message = "Uno de los archivos supera el tamaño máximo de 20 MB.";
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      message = "Se enviaron demasiados archivos.";
    }

    return res.status(400).json({ message });
  });

module.exports = upload;

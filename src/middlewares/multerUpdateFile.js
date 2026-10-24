const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Mismas extensiones que el director puede configurar en los requisitos
const EXTENSIONES_PERMITIDAS = [".pdf", ".docx", ".xlsx", ".jpg", ".jpeg", ".png"];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const respuesta = req.respuestaParticipacion;

    const carpeta = path.dirname(
      path.join(__dirname, "..", respuesta.ruta_archivo),
    );

    fs.mkdirSync(carpeta, { recursive: true });

    cb(null, carpeta);
  },

  filename(req, file, cb) {
    const respuesta = req.respuestaParticipacion;

    const nombreBase = path.basename(
      respuesta.ruta_archivo,
      path.extname(respuesta.ruta_archivo),
    );

    cb(null, `${nombreBase}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const fileFilter = (req, file, cb) => {
  const respuesta = req.respuestaParticipacion;

  if (respuesta.tipo_respuesta !== "documento" || !respuesta.ruta_archivo) {
    return cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "La respuesta seleccionada no corresponde a un documento.",
      ),
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
    files: 1,
  },
});

// Igual que upload.single, pero devuelve los errores de multer como 400
// con un mensaje claro en lugar de dejarlos sin manejar
upload.singleConManejo = (campo) => (req, res, next) =>
  upload.single(campo)(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "El archivo supera el tamaño máximo de 20 MB."
        : error.field || error.message;

    return res.status(400).json({ message });
  });

module.exports = upload;

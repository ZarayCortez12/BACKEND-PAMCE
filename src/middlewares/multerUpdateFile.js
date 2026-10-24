const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

    cb(null, `${nombreBase}${path.extname(file.originalname)}`);
  },
});

module.exports = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { numero_documento, nombre_edicion, nombre_categoria } = req.body;

    const basePath = path.join(
      __dirname,
      "..",
      "documentos",
      String(nombre_edicion),
      String(nombre_categoria),
      `PARTICIPACION_USUARIO_${numero_documento}`,
    );

    fs.mkdirSync(basePath, { recursive: true });

    cb(null, basePath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = file.fieldname.replace(/\[|\]/g, "_");

    cb(null, `${cleanName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

module.exports = upload;

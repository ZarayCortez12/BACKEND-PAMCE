const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// Palabras de enlace que en un título van en minúscula (salvo al inicio)
const PALABRAS_MENORES = new Set(["a", "al", "de", "del", "e", "el", "en", "la", "las", "los", "o", "u", "y"]);

const capitalizarIniciales = (texto) => {
  if (!texto) return "";

  return texto
    .toLowerCase()
    .split(" ")
    .map((palabra, i) =>
      i > 0 && PALABRAS_MENORES.has(palabra)
        ? palabra
        : palabra.replace(/(?<!\p{L})\p{L}/gu, (letra) => letra.toUpperCase()),
    )
    .join(" ");
};

// "primer", "segundo"... para el texto del certificado de ganador
const ORDINALES = ["primer", "segundo", "tercer", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo"];

const puestoEnTexto = (puesto) => {
  const numero = Number(puesto);
  if (!Number.isInteger(numero) || numero < 1) return null;
  return ORDINALES[numero - 1] || `${numero}.º`;
};

const generarCertificado = async ({
  nombreParticipante,
  nombreEdicion,
  nombreCategoria,
  esGanador = false,
  puesto = null,
}) => {
  // Si es ganador se genera el certificado de reconocimiento con su puesto;
  // si no, el de participación
  const ordinal = esGanador ? puestoEnTexto(puesto) : null;
  const ganador = Boolean(esGanador);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      });

      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));

      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });

      doc.on("error", reject);

      const W = doc.page.width;
      const H = doc.page.height;

      const rojo = "#C21111";
      const rojoOscuro = "#8F0B0B";
      const rojoMedio = "#A90F0F";

      const dorado = "#C9A227";
      const doradoClaro = "#E8D79A";

      const negro = "#252525";
      const gris = "#666666";
      const blanco = "#FFFFFF";
      const marfil = "#FCFBF8";

      const edicionFormateada = capitalizarIniciales(nombreEdicion);

      const categoriaFormateada = capitalizarIniciales(nombreCategoria);

      doc.rect(0, 0, W, H).fill(marfil);

      doc
        .lineWidth(1.4)
        .strokeColor(rojo)
        .rect(30, 30, W - 60, H - 60)
        .stroke();

      doc
        .lineWidth(0.6)
        .strokeColor(doradoClaro)
        .rect(36, 36, W - 72, H - 72)
        .stroke();

      doc
        .moveTo(W, 0)
        .lineTo(W - 335, 0)
        .bezierCurveTo(W - 245, 15, W - 105, 60, W, 150)
        .lineTo(W, 0)
        .closePath()
        .fill(rojoOscuro);

      doc
        .moveTo(W, 0)
        .lineTo(W - 300, 0)
        .bezierCurveTo(W - 215, 15, W - 90, 55, W, 130)
        .lineTo(W, 0)
        .closePath()
        .fill(rojo);

      doc
        .moveTo(W, 0)
        .lineTo(W - 260, 0)
        .bezierCurveTo(W - 180, 13, W - 75, 48, W, 108)
        .lineTo(W, 0)
        .closePath()
        .fill(rojoMedio);

      doc
        .moveTo(W, 0)
        .lineTo(W - 220, 0)
        .bezierCurveTo(W - 150, 10, W - 60, 38, W, 82)
        .lineWidth(1.5)
        .strokeColor(rojoOscuro)
        .stroke();

      doc
        .moveTo(0, H)
        .lineTo(335, H)
        .bezierCurveTo(245, H - 15, 105, H - 60, 0, H - 150)
        .lineTo(0, H)
        .closePath()
        .fill(rojoOscuro);

      doc
        .moveTo(0, H)
        .lineTo(300, H)
        .bezierCurveTo(215, H - 15, 90, H - 55, 0, H - 130)
        .lineTo(0, H)
        .closePath()
        .fill(rojo);

      doc
        .moveTo(0, H)
        .lineTo(260, H)
        .bezierCurveTo(180, H - 13, 75, H - 48, 0, H - 108)
        .lineTo(0, H)
        .closePath()
        .fill(rojoMedio);

      doc
        .moveTo(0, H)
        .lineTo(220, H)
        .bezierCurveTo(150, H - 10, 60, H - 38, 0, H - 82)
        .lineWidth(1.5)
        .strokeColor(rojoOscuro)
        .stroke();

      const centroX = W / 2;
      const centroY = 355;

      doc
        .save()
        .translate(centroX - 105, centroY + 35)
        .rotate(-28);

      for (let i = 0; i < 7; i++) {
        const y = -i * 23;

        doc.ellipse(0, y, 7, 15).fill("#F3E8E1");
      }

      doc.restore();

      doc
        .save()
        .translate(centroX + 105, centroY + 35)
        .rotate(28);

      for (let i = 0; i < 7; i++) {
        const y = -i * 23;

        doc.ellipse(0, y, 7, 15).fill("#F3E8E1");
      }

      doc.restore();

      const logoPath = path.join(__dirname, "../images/logo_entidad-png.png");

      if (fs.existsSync(logoPath)) {
        const logoWidth = 120;
        const logoX = 55;
        const logoY = 48;

        doc.image(logoPath, logoX, logoY, {
          width: logoWidth,
        });
      }

      doc
        .font("Times-Bold")
        .fontSize(29)
        .fillColor(rojo)
        .text("CERTIFICADO DE", 0, 143, {
          width: W,
          align: "center",
          characterSpacing: 0.8,
        });

      doc
        .font("Times-Bold")
        .fontSize(31)
        .fillColor(rojo)
        .text(ganador ? "RECONOCIMIENTO" : "PARTICIPACIÓN", 0, 178, {
          width: W,
          align: "center",
          characterSpacing: 1,
        });

      doc
        .moveTo(330, 218)
        .lineTo(510, 218)
        .lineWidth(1.2)
        .strokeColor(dorado)
        .stroke();

      doc
        .save()
        .translate(420, 218)
        .rotate(45)
        .rect(-4, -4, 8, 8)
        .fill(dorado)
        .restore();

      doc
        .font("Helvetica")
        .fontSize(11.5)
        .fillColor(gris)
        .text(
          "El Programa de Ingeniería de Sistemas de la Universidad Francisco de Paula Santander se complace en certificar que",
          0,
          238,
          {
            width: W,
            align: "center",
          },
        );

      const fuenteFirma = path.join(
        __dirname,
        "../public/fonts/GreatVibes-Regular.ttf",
      );

      if (fs.existsSync(fuenteFirma)) {
        doc.font(fuenteFirma);
      } else {
        doc.font("Times-Italic");
      }

      doc
        .fontSize(40)
        .fillColor(rojo)
        .text(nombreParticipante, 80, 270, {
          width: W - 160,
          align: "center",
        });

      doc
        .moveTo(250, 312)
        .lineTo(590, 312)
        .lineWidth(0.8)
        .strokeColor(doradoClaro)
        .stroke();

      const textoParticipacion =
        `participó en la ${edicionFormateada} ` +
        `del Premio Anual al Mérito Científico y Empresarial (PAMCE), ` +
        `en la categoría ${categoriaFormateada}, ` +
        `como reconocimiento a su interés, compromiso ` +
        `y participación en esta iniciativa institucional.`;

      const textoGanador =
        `obtuvo ${ordinal ? `el ${ordinal} puesto` : "el reconocimiento como ganador(a)"} ` +
        `en la categoría ${categoriaFormateada} de la ${edicionFormateada} ` +
        `del Premio Anual al Mérito Científico y Empresarial (PAMCE), ` +
        `en reconocimiento a la excelencia de su trabajo y a su aporte ` +
        `al desarrollo científico y empresarial.`;

      let inicioTexto = 330;

      if (ganador) {
        // Insignia dorada con el puesto, debajo del nombre
        const textoInsignia = ordinal
          ? `${ordinal.toUpperCase()} PUESTO`
          : "GANADOR(A)";
        const anchoInsignia = 170;

        doc
          .roundedRect(centroX - anchoInsignia / 2, 320, anchoInsignia, 22, 11)
          .fill(dorado);

        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(blanco)
          .text(textoInsignia, centroX - anchoInsignia / 2, 326, {
            width: anchoInsignia,
            align: "center",
            characterSpacing: 1.5,
          });

        inicioTexto = 352;
      }

      doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor(negro)
        .text(ganador ? textoGanador : textoParticipacion, 145, inicioTexto, {
          width: W - 290,
          align: "center",
          lineGap: 4,
        });

      const firmaPath = path.join(__dirname, "../images/imagen_firma.png");

      const firmaX = 185;
      const firmaY = 475;
      const firmaWidth = 155;

      if (fs.existsSync(firmaPath)) {
        doc.image(firmaPath, firmaX + 5, firmaY - 48, {
          width: firmaWidth,
        });
      }

      doc
        .moveTo(firmaX, firmaY)
        .lineTo(firmaX + 165, firmaY)
        .lineWidth(0.7)
        .strokeColor("#999999")
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(negro)
        .text("Director del Programa", firmaX, firmaY + 7, {
          width: 165,
          align: "center",
        });

      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(gris)
        .text("Ingeniería de Sistemas", firmaX, firmaY + 20, {
          width: 165,
          align: "center",
        });

      const firma2X = 485;
      const firma2Y = 475;

      doc
        .moveTo(firma2X, firma2Y)
        .lineTo(firma2X + 165, firma2Y)
        .lineWidth(0.7)
        .strokeColor("#999999")
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(negro)
        .text("Coordinación PAMCE", firma2X, firma2Y + 7, {
          width: 165,
          align: "center",
        });

      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(gris)
        .text("Programa de Reconocimiento", firma2X, firma2Y + 20, {
          width: 165,
          align: "center",
        });

      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor("#999999")
        .text(
          "PAMCE • Premio Anual al Mérito Científico y Empresarial",
          0,
          H - 20,
          {
            width: W,
            align: "center",
            characterSpacing: 0.5,
          },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generarCertificado,
};

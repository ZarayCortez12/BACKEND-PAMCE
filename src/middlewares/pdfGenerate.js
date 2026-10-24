const PDFDocument = require("pdfkit");
const path = require("path");
const dayjs = require("dayjs");

const generarPDF = async (
  tipoReporte,
  data,
  fecha,
  filtros = {},
  res,
  orientacion = "portrait",
) => {
  const doc = new PDFDocument({
    margin: 40,
    size: "A4",
    layout: orientacion,
    bufferPages: true,
  });

  res.setHeader("Content-Type", "application/pdf");

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=reporte_${tipoReporte}.pdf`,
  );

  doc.pipe(res);

  const logoUniversidad = path.join(__dirname, "../images/logo_entidad.png");

  const logoIng = path.join(__dirname, "../images/logo-ing-sistemas.png");

  const startX = 40;
  let startY = 30;

  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 80;

  const tableWidth = contentWidth;

  const leftWidth = contentWidth * 0.23;
  const centerWidth = contentWidth * 0.54;
  const rightWidth = contentWidth * 0.23;

  const tableHeight = 90;

  doc
    .rect(startX, startY, tableWidth, tableHeight)
    .lineWidth(1)
    .stroke("#BDBDBD");

  doc
    .moveTo(startX + leftWidth, startY)
    .lineTo(startX + leftWidth, startY + tableHeight)
    .stroke();

  doc
    .moveTo(startX + leftWidth + centerWidth, startY)
    .lineTo(startX + leftWidth + centerWidth, startY + tableHeight)
    .stroke();

  const logoUniversidadWidth = orientacion === "landscape" ? 110 : 90;

  const logoUniversidadHeight = orientacion === "landscape" ? 60 : 55;

  const logoUniversidadX = startX + (leftWidth - logoUniversidadWidth) / 2;

  const logoUniversidadY = startY + (tableHeight - logoUniversidadHeight) / 2;

  doc.image(logoUniversidad, logoUniversidadX, logoUniversidadY, {
    width: logoUniversidadWidth,
    height: logoUniversidadHeight,
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(orientacion === "landscape" ? 23 : 16)
    .fillColor("#1F2937")
    .text(
      `REPORTE DE ${tipoReporte.toUpperCase()}`,
      startX + leftWidth,
      startY + 35,
      {
        width: centerWidth,
        align: "center",
      },
    );

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#6B7280")
    .text("Sistema de Reportes PAMCE", startX + leftWidth, startY + 65, {
      width: centerWidth,
      align: "center",
    });

  const logoIngWidth = orientacion === "landscape" ? 135 : 105;

  const logoIngHeight = orientacion === "landscape" ? 55 : 50;

  const logoIngX =
    startX + leftWidth + centerWidth + (rightWidth - logoIngWidth) / 2;

  const logoIngY = startY + (tableHeight - logoIngHeight) / 2;

  doc.image(logoIng, logoIngX, logoIngY, {
    width: logoIngWidth,
    height: logoIngHeight,
  });

  doc
    .moveTo(startX, 140)
    .lineTo(startX + tableWidth, 140)
    .lineWidth(1.5)
    .strokeColor("#D1D5DB")
    .stroke();

  startY = 155;

  const filtrosAplicados = Object.entries(filtros)
    .filter(
      ([key, value]) =>
        value &&
        !["page", "limit", "sortBy", "sortOrder"].includes(key) &&
        value !== "TODOS",
    )
    .map(
      ([key, value]) =>
        `${formatearTexto(key)}: ${formatearTexto(String(value))}`,
    );

  const filtrosTexto = filtrosAplicados.length
    ? filtrosAplicados.join("\n")
    : "Sin filtros aplicados";

  const anchoContenido = doc.page.width - 80;

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#1F2937")
    .text("1. RESUMEN DEL REPORTE", 40, startY);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#4B5563")
    .text(
      "En la presente sección se relacionan los registros consolidados correspondientes a las participaciones procesadas en la plataforma PAMCE, conforme a los parámetros establecidos para la generación del reporte institucional",
      40,
      startY + 25,
      {
        width: anchoContenido,
        height: 25,
        lineGap: 2,
      },
    );

  const tarjetasY = startY + 60;
  const espacioTarjetas = 12;
  const tarjetaWidth = (anchoContenido - espacioTarjetas * 2) / 3;

  const tarjetas = [
    {
      titulo: "FECHA DE GENERACIÓN",
      valor: fecha,
      x: 40,
      altura: 47,
    },
    {
      titulo: `TOTAL DE ${tipoReporte.toUpperCase()}`,
      valor: String(data.length),
      x: 40 + tarjetaWidth + espacioTarjetas,
      altura: 47,
    },
    {
      titulo: "FILTROS APLICADOS",
      valor: filtrosTexto,
      x: 40 + (tarjetaWidth + espacioTarjetas) * 2,
      altura: Math.max(47, 32 + filtrosAplicados.length * 12),
    },
  ];

  tarjetas.forEach((tarjeta, index) => {
    doc
      .roundedRect(tarjeta.x, tarjetasY, tarjetaWidth, tarjeta.altura, 6)
      .fillAndStroke("#F8FAFC", "#E2E8F0");

    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(index === 1 ? "#C21111" : "#64748B")
      .text(tarjeta.titulo, tarjeta.x + 10, tarjetasY + 8, {
        width: tarjetaWidth - 20,
        height: 10,
        ellipsis: true,
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(index === 1 ? 15 : 8)
      .fillColor("#1F2937")
      .text(tarjeta.valor, tarjeta.x + 10, tarjetasY + 23, {
        width: tarjetaWidth - 20,
        lineGap: 2,
        lineBreak: true,
      });
  });

  const alturaTarjetas = Math.max(...tarjetas.map((tarjeta) => tarjeta.altura));
  const siguienteSeccionY = tarjetasY + alturaTarjetas + 18;

  if (tipoReporte === "participaciones") {
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1F2937")
      .text("2. ANÁLISIS GRÁFICO", 40, siguienteSeccionY);

    generarGraficasParticipaciones(doc, data, siguienteSeccionY + 20);

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1F2937")
      .text("3. RESULTADO DEL REPORTE", 40, 410);

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#4B5563")
      .text(
        "En esta sección se presenta el consolidado de registros del reporte, conforme a los filtros seleccionados para la generación del documento institucional.",
        40,
        430,
        {
          width: anchoContenido,
          align: "justify",
          lineGap: 3,
        },
      );

    startY = 465;
  } else if (tipoReporte === "postulaciones") {
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1F2937")
      .text("2. ANÁLISIS GRÁFICO", 40, siguienteSeccionY);

    generarGraficasPostulaciones(doc, data, siguienteSeccionY + 20);

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1F2937")
      .text("3. RESULTADOS DEL REPORTE", 40, 410);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#4B5563")
      .text(
        "En esta sección se presenta el consolidado de registros del reporte, conforme a los filtros seleccionados para la generación del documento institucional.",
        40,
        430,
        {
          width: anchoContenido,
          align: "justify",
          lineGap: 3,
        },
      );

    startY = 400;
  } else if (tipoReporte === "convocatorias") {
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1F2937")
      .text("2. ANÁLISIS GRÁFICO", 40, siguienteSeccionY);

    generarGraficasConvocatorias(doc, data, siguienteSeccionY + 22);

    startY = 410;

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1F2937")
      .text("3. RESULTADOS DEL REPORTE", 40, startY);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#4B5563")
      .text(
        "En esta sección se presenta el consolidado de convocatorias, con sus respectivos participantes, ediciones, fechas de envío, estados y número de intentos registrados.",
        40,
        startY + 23,
        {
          width: anchoContenido,
          align: "justify",
          lineGap: 3,
        },
      );

    startY += 65;
  } else if (tipoReporte === "usuarios") {
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1F2937")
      .text("2. ANÁLISIS GRÁFICO", 40, siguienteSeccionY);

    generarGraficasUsuarios(doc, data, siguienteSeccionY + 20);

    const resultadosY = siguienteSeccionY + 250;

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1F2937")
      .text("3. RESULTADOS DEL REPORTE", 40, resultadosY);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#4B5563")
      .text(
        "En esta sección se presenta la relación de usuarios que cumplen los filtros seleccionados, incluyendo sus datos de identificación, contacto y nivel de estudio.",
        40,
        resultadosY + 23,
        {
          width: anchoContenido,
          align: "justify",
          lineGap: 3,
        },
      );

    startY = resultadosY + 10;
  } else {
    startY = tarjetasY + alturaTarjetas + 18;

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1F2937")
      .text("2. RESULTADOS DEL REPORTE", 40, startY);

    startY += 25;

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#4B5563")
      .text(
        "En esta sección se relacionan los registros consolidados conforme a los filtros seleccionados para la generación del reporte institucional.",
        40,
        startY,
        {
          width: anchoContenido,
          align: "justify",
          lineGap: 3,
        },
      );

    startY += 45;
  }

  const agregarFooter = (doc, paginaActual, totalPaginas) => {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    const footerY =
      orientacion === "landscape" ? pageHeight - 95 : pageHeight - 95;

    doc
      .moveTo(70, footerY)
      .lineTo(pageWidth - 70, footerY)
      .lineWidth(1)
      .strokeColor("#A30000")
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#4B5563")
      .text("Avenida Gran Colombia No. 12E-96 Barrio Colsag", 40, footerY + 8, {
        width: pageWidth - 80,
        align: "center",
      });

    doc.text("Teléfono (057)(7) 5776655 - www.ufps.edu.co", 40, footerY + 20, {
      width: pageWidth - 80,
      align: "center",
    });

    doc.text(
      "ugad@ufps.edu.co  San José de Cúcuta - Colombia",
      40,
      footerY + 32,
      {
        width: pageWidth - 80,
        align: "center",
      },
    );

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#6B7280")
      .text(`Página ${paginaActual} de ${totalPaginas}`, 40, footerY + 44, {
        width: pageWidth - 80,
        align: "center",
      });
  };

  if (tipoReporte === "participaciones") {
    generarTablaParticipaciones(doc, data, startY, agregarFooter);
  }

  if (tipoReporte === "postulaciones") {
    generarTablaPostulaciones(doc, data, startY, agregarFooter);
  }

  if (tipoReporte === "convocatorias") {
    generarTablaConvocatorias(doc, data, startY, agregarFooter);
  }

  if (tipoReporte === "usuarios") {
    generarTablaUsuarios(doc, data, startY, agregarFooter);
  }

  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);

    agregarFooter(doc, i + 1, range.count);
  }

  doc.end();
};

const capitalizarNombre = (texto) => {
  const nombre = String(texto || "Sin categoría")
    .trim()
    .toLocaleLowerCase("es");

  return nombre.charAt(0).toLocaleUpperCase("es") + nombre.slice(1);
};

const generarGraficasParticipaciones = (doc, data, y = 286) => {
  const pageWidth = doc.page.width;
  const margen = 40;
  const anchoContenido = pageWidth - margen * 2;
  const separacion = 12;
  const anchoCategorias = 470;
  const anchoEstados = anchoContenido - anchoCategorias - separacion;
  const xCategorias = margen;
  const xEstados = xCategorias + anchoCategorias + separacion;
  const altoPanel = 90;

  const colorPrincipal = "#C21111"; // Rojo institucional
  const colorTexto = "#1F2937";
  const colorSuave = "#64748B";
  const colorBorde = "#E2E8F0";
  const colorFondo = "#FFFFFF";
  const colorBarraFondo = "#F1F5F9";

  const coloresCategorias = [
    "#C21111",
    "#2563EB",
    "#059669",
    "#D97706",
    "#7C3AED",
  ];

  const colorAceptada = "#059669";
  const colorEvaluada = "#2563EB";

  const porCategoria = {};

  data.forEach((participacion) => {
    const nombre = capitalizarNombre(
      participacion.edicionCategoria?.categoria?.nombre_categoria ||
        "Sin categoría",
    );

    porCategoria[nombre] = (porCategoria[nombre] || 0) + 1;
  });

  const categorias = Object.entries(porCategoria)
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const totalParticipaciones = data.length;

  const estados = {
    aceptada: data.filter(
      (item) => String(item.estado).toLowerCase() === "aceptada",
    ).length,
    evaluada: data.filter(
      (item) => String(item.estado).toLowerCase() === "evaluada",
    ).length,
  };

  const totalEstados = estados.aceptada + estados.evaluada;

  doc
    .roundedRect(xCategorias, y, anchoCategorias, altoPanel, 7)
    .fillAndStroke(colorFondo, colorBorde);

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(colorTexto)
    .text("Participaciones por categoría", xCategorias + 12, y + 9, {
      width: anchoEstados - 24,
    });

  doc.font("Helvetica").fontSize(7).fillColor(colorSuave);

  doc
    .roundedRect(xEstados, y, anchoEstados, altoPanel, 7)
    .fillAndStroke(colorFondo, colorBorde);

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(colorTexto)
    .text("Participaciones por categoría", xEstados + 12, y + 9, {
      width: anchoEstados - 24,
    });

  doc.font("Helvetica").fontSize(7).fillColor(colorSuave);

  if (categorias.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(colorSuave)
      .text("No hay registros para representar.", xCategorias + 12, y + 48);
  } else {
    const maximo = Math.max(...categorias.map((item) => item.total), 1);
    const etiquetaX = xCategorias + 12;
    const barraX = xCategorias + 135;
    const anchoBarra = 270;
    const altoBarra = 7;
    const inicioY = y + 35;
    const saltoY = 10;

    categorias.forEach((item, index) => {
      const filaY = inicioY + index * saltoY;
      const proporcion = item.total / maximo;
      const anchoRelleno = Math.max(anchoBarra * proporcion, 2);
      const porcentaje =
        totalParticipaciones > 0
          ? Math.round((item.total / totalParticipaciones) * 100)
          : 0;

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(colorTexto)
        .text(item.nombre, etiquetaX, filaY, {
          width: 115,
          height: 9,
          ellipsis: true,
        });

      doc
        .roundedRect(barraX, filaY, anchoBarra, altoBarra, 3)
        .fill(colorBarraFondo);

      doc
        .roundedRect(barraX, filaY, anchoRelleno, altoBarra, 3)
        .fill(coloresCategorias[index % coloresCategorias.length]);

      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(colorTexto)
        .text(
          `${item.total} (${porcentaje}%)`,
          barraX + anchoBarra + 7,
          filaY - 1,
          { width: 45 },
        );
    });
  }

  doc
    .roundedRect(xEstados, y, anchoEstados, altoPanel, 7)
    .fillAndStroke(colorFondo, colorBorde);

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(colorTexto)
    .text("Estado de las participaciones", xEstados + 12, y + 9, {
      width: anchoEstados - 24,
    });

  doc.font("Helvetica").fontSize(7).fillColor(colorSuave);

  const barraX = xEstados + 12;
  const barraY = y + 39;
  const barraW = anchoEstados - 24;
  const barraH = 12;

  doc.roundedRect(barraX, barraY, barraW, barraH, 4).fill(colorBarraFondo);

  if (totalEstados > 0) {
    const anchoAceptadas = (estados.aceptada / totalEstados) * barraW;
    const anchoEvaluadas = (estados.evaluada / totalEstados) * barraW;
    const radio = 4;

    if (estados.aceptada > 0 && estados.evaluada > 0) {
      doc
        .roundedRect(barraX, barraY, anchoAceptadas + radio, barraH, radio)
        .fill(colorAceptada);

      doc
        .roundedRect(
          barraX + anchoAceptadas - radio,
          barraY,
          anchoEvaluadas + radio,
          barraH,
          radio,
        )
        .fill(colorEvaluada);

      doc
        .rect(barraX + anchoAceptadas - radio, barraY, radio * 2, barraH)
        .fill(colorEvaluada);
    } else if (estados.aceptada > 0) {
      doc
        .roundedRect(barraX, barraY, barraW, barraH, radio)
        .fill(colorAceptada);
    } else if (estados.evaluada > 0) {
      doc
        .roundedRect(barraX, barraY, barraW, barraH, radio)
        .fill(colorEvaluada);
    }
  }

  const porcentajeAceptadas =
    totalEstados > 0 ? Math.round((estados.aceptada / totalEstados) * 100) : 0;

  const porcentajeEvaluadas =
    totalEstados > 0 ? Math.round((estados.evaluada / totalEstados) * 100) : 0;

  doc.circle(xEstados + 17, y + 65, 3).fill(colorAceptada);

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(colorTexto)
    .text("Aceptadas", xEstados + 25, y + 61);

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(colorSuave)
    .text(
      `${estados.aceptada} · ${porcentajeAceptadas}%`,
      xEstados + 25,
      y + 72,
    );

  doc.circle(xEstados + 145, y + 65, 3).fill(colorEvaluada);

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(colorTexto)
    .text("Evaluadas", xEstados + 153, y + 61);

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(colorSuave)
    .text(
      `${estados.evaluada} · ${porcentajeEvaluadas}%`,
      xEstados + 153,
      y + 72,
    );
};

const generarGraficasPostulaciones = (doc, data, y = 286) => {
  const margen = 40;
  const anchoContenido = doc.page.width - margen * 2;
  const separacion = 12;

  const anchoCategorias = 470;
  const anchoEstados = anchoContenido - anchoCategorias - separacion;

  const xCategorias = margen;
  const xEstados = xCategorias + anchoCategorias + separacion;

  const altoPanel = 80;

  const colorTexto = "#1F2937";
  const colorSecundario = "#64748B";
  const colorBorde = "#E2E8F0";
  const colorFondo = "#FFFFFF";
  const colorBarraFondo = "#F1F5F9";

  const colores = [
    "#C21111",
    "#2563EB",
    "#059669",
    "#D97706",
    "#7C3AED",
    "#0891B2",
  ];

  const normalizarTexto = (valor) =>
    String(valor || "Sin estado")
      .trim()
      .toLocaleLowerCase("es");

  const contarPorCampo = (registros, obtenerNombre) => {
    const conteo = {};

    registros.forEach((registro) => {
      const nombre = obtenerNombre(registro);

      conteo[nombre] = (conteo[nombre] || 0) + 1;
    });

    return Object.entries(conteo)
      .map(([nombre, total]) => ({
        nombre,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  };

  const categorias = contarPorCampo(data, (postulacion) =>
    capitalizarNombre(
      postulacion.edicionCategoria?.categoria?.nombre_categoria ||
        "Sin categoría",
    ),
  ).slice(0, 5);

  const estados = contarPorCampo(data, (postulacion) =>
    capitalizarNombre(normalizarTexto(postulacion.estado)),
  );

  const dibujarPanel = (x, titulo, ancho) => {
    doc
      .roundedRect(x, y, ancho, altoPanel, 7)
      .fillAndStroke(colorFondo, colorBorde);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(colorTexto)
      .text(titulo, x + 12, y + 10, {
        width: ancho - 24,
        ellipsis: true,
      });
  };

  // Panel izquierdo: postulaciones por categoría
  dibujarPanel(xCategorias, "Postulaciones por categoría", anchoCategorias);

  if (categorias.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(colorSecundario)
      .text("No hay postulaciones para representar.", xCategorias + 12, y + 48);
  } else {
    const maximo = Math.max(
      ...categorias.map((categoria) => categoria.total),
      1,
    );

    const etiquetaX = xCategorias + 12;
    const barraX = xCategorias + 135;
    const anchoBarra = 270;
    const altoBarra = 8;
    const inicioY = y + 34;
    const saltoY = 14;

    categorias.forEach((categoria, index) => {
      const filaY = inicioY + index * saltoY;
      const anchoRelleno = (categoria.total / maximo) * anchoBarra;

      const porcentaje =
        data.length > 0 ? Math.round((categoria.total / data.length) * 100) : 0;

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(colorTexto)
        .text(categoria.nombre, etiquetaX, filaY, {
          width: 115,
          height: 10,
          ellipsis: true,
        });

      doc
        .roundedRect(barraX, filaY, anchoBarra, altoBarra, 3)
        .fill(colorBarraFondo);

      if (anchoRelleno > 0) {
        doc
          .roundedRect(barraX, filaY, Math.max(anchoRelleno, 2), altoBarra, 3)
          .fill(colores[index % colores.length]);
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(colorTexto)
        .text(
          `${categoria.total} (${porcentaje}%)`,
          barraX + anchoBarra + 7,
          filaY - 1,
          { width: 45 },
        );
    });
  }

  // Panel derecho: postulaciones por estado
  dibujarPanel(xEstados, "Postulaciones por estado", anchoEstados);

  if (estados.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(colorSecundario)
      .text("No hay estados para representar.", xEstados + 12, y + 48);
  } else {
    const maximo = Math.max(...estados.map((estado) => estado.total), 1);

    const barraX = xEstados + 95;
    const anchoBarra = anchoEstados - 150;
    const altoBarra = 8;
    const inicioY = y + 34;
    const saltoY = 14;

    estados.slice(0, 5).forEach((estado, index) => {
      const filaY = inicioY + index * saltoY;
      const anchoRelleno = (estado.total / maximo) * anchoBarra;

      const porcentaje =
        data.length > 0 ? Math.round((estado.total / data.length) * 100) : 0;

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(colorTexto)
        .text(estado.nombre, xEstados + 12, filaY, {
          width: 78,
          height: 10,
          ellipsis: true,
        });

      doc
        .roundedRect(barraX, filaY, anchoBarra, altoBarra, 3)
        .fill(colorBarraFondo);

      if (anchoRelleno > 0) {
        doc
          .roundedRect(barraX, filaY, Math.max(anchoRelleno, 2), altoBarra, 3)
          .fill(colores[index % colores.length]);
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(colorTexto)
        .text(
          `${estado.total} (${porcentaje}%)`,
          barraX + anchoBarra + 5,
          filaY - 1,
          { width: 45 },
        );
    });
  }
};

const generarGraficasConvocatorias = (doc, data, y = 286) => {
  const margen = 40;
  const anchoContenido = doc.page.width - margen * 2;
  const separacion = 12;

  const anchoEstados = anchoContenido * 0.52;
  const anchoEnvios = anchoContenido - anchoEstados - separacion;

  const xEstados = margen;
  const xEnvios = xEstados + anchoEstados + separacion;

  const altoPanel = 90;

  const colorTexto = "#1F2937";
  const colorSecundario = "#64748B";
  const colorBorde = "#E2E8F0";
  const colorFondo = "#FFFFFF";
  const colorBarraFondo = "#F1F5F9";

  const colores = [
    "#C21111",
    "#2563EB",
    "#059669",
    "#D97706",
    "#7C3AED",
    "#0891B2",
  ];

  const normalizarTexto = (valor) =>
    String(valor || "Sin estado")
      .trim()
      .toLocaleLowerCase("es");

  const contarPorCampo = (registros, obtenerValor) => {
    const conteo = {};

    registros.forEach((registro) => {
      const valor = obtenerValor(registro);
      conteo[valor] = (conteo[valor] || 0) + 1;
    });

    return Object.entries(conteo)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total);
  };

  // Panel izquierdo: distribución por estado
  const estados = contarPorCampo(data, (convocatoria) =>
    capitalizarNombre(normalizarTexto(convocatoria.estado_envio)),
  );

  // Panel derecho: distribución por número de envíos
  const envios = contarPorCampo(data, (convocatoria) => {
    const numero = Number(convocatoria.intentos_envio);

    return Number.isFinite(numero)
      ? `${numero} ${numero === 1 ? "envío" : "envíos"}`
      : "Sin dato";
  }).sort((a, b) => {
    const numeroA = Number.parseInt(a.nombre, 10);
    const numeroB = Number.parseInt(b.nombre, 10);

    if (!Number.isFinite(numeroA)) return 1;
    if (!Number.isFinite(numeroB)) return -1;

    return numeroA - numeroB;
  });

  const dibujarPanel = (x, titulo, ancho) => {
    doc
      .roundedRect(x, y, ancho, altoPanel, 7)
      .fillAndStroke(colorFondo, colorBorde);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(colorTexto)
      .text(titulo, x + 12, y + 10, {
        width: ancho - 24,
        ellipsis: true,
      });
  };

  const dibujarBarras = ({ registros, x, ancho, maxFilas = 5 }) => {
    const visibles = registros.slice(0, maxFilas);

    if (visibles.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(colorSecundario)
        .text("No hay registros para representar.", x + 12, y + 50);

      return;
    }

    const maximo = Math.max(...visibles.map((registro) => registro.total), 1);

    const etiquetaX = x + 12;
    const anchoEtiqueta = Math.min(85, ancho * 0.28);
    const barraX = etiquetaX + anchoEtiqueta + 5;
    const anchoBarra = Math.max(ancho - anchoEtiqueta - 75, 20);

    const altoBarra = 8;
    const inicioY = y + 34;
    const saltoY = 14;

    visibles.forEach((registro, index) => {
      const filaY = inicioY + index * saltoY;
      const anchoRelleno = (registro.total / maximo) * anchoBarra;

      const porcentaje =
        data.length > 0 ? Math.round((registro.total / data.length) * 100) : 0;

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(colorTexto)
        .text(registro.nombre, etiquetaX, filaY, {
          width: anchoEtiqueta,
          height: 10,
          ellipsis: true,
        });

      doc
        .roundedRect(barraX, filaY, anchoBarra, altoBarra, 3)
        .fill(colorBarraFondo);

      if (anchoRelleno > 0) {
        doc
          .roundedRect(barraX, filaY, Math.max(anchoRelleno, 2), altoBarra, 3)
          .fill(colores[index % colores.length]);
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(colorTexto)
        .text(
          `${registro.total} (${porcentaje}%)`,
          barraX + anchoBarra + 5,
          filaY - 1,
          { width: 45 },
        );
    });
  };

  // Gráfica 1: estados
  dibujarPanel(xEstados, "Convocatorias por estado", anchoEstados);

  dibujarBarras({
    registros: estados,
    x: xEstados,
    ancho: anchoEstados,
  });

  // Gráfica 2: número de envíos
  dibujarPanel(xEnvios, "Convocatorias por número de envíos", anchoEnvios);

  dibujarBarras({
    registros: envios,
    x: xEnvios,
    ancho: anchoEnvios,
  });
};


const generarGraficasUsuarios = (doc, data, y = 286) => {
  const margen = 40;
  const anchoContenido = doc.page.width - margen * 2;
  const separacion = 12;
  const anchoPanel = (anchoContenido - separacion) / 2;
  const altoPanel = 100;

  const colorTexto = "#1F2937";
  const colorSecundario = "#64748B";
  const colorBorde = "#E2E8F0";
  const colorFondo = "#FFFFFF";
  const colorBarraFondo = "#F1F5F9";

  const coloresNivel = [
    "#C21111",
    "#2563EB",
    "#059669",
    "#D97706",
    "#7C3AED",
    "#0891B2",
    "#DB2777",
  ];

  const coloresGenero = {
    femenino: "#7C3AED",
    masculino: "#2563EB",
    otro: "#059669",
    "sin especificar": "#94A3B8",
  };

  const coloresRol = {
    administrador: "#C21111",
    jurado: "#2563EB",
    participante: "#059669",
  };

  const normalizar = (valor, defecto = "Sin especificar") => {
    const texto = String(valor ?? "").trim();

    if (!texto || texto.toLowerCase() === "null") {
      return defecto;
    }

    return texto
      .toLocaleLowerCase("es")
      .replace(/\b\p{L}/gu, letra => letra.toLocaleUpperCase("es"));
  };

  const contarPorCampo = (registros, obtenerValor) => {
    const conteo = {};

    registros.forEach(registro => {
      const nombre = obtenerValor(registro);
      conteo[nombre] = (conteo[nombre] || 0) + 1;
    });

    return Object.entries(conteo)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total);
  };

  const niveles = contarPorCampo(
    data,
    usuario => normalizar(usuario.nivel_estudio_superior)
  );

  const generos = contarPorCampo(
    data,
    usuario => normalizar(usuario.genero)
  );

  // Un usuario puede tener varios roles.
  // Se cuenta cada usuario una sola vez por cada rol que tenga.
  const conteoRoles = {};

  data.forEach(usuario => {
    const rolesUsuario = usuario.roles || [];

    if (rolesUsuario.length === 0) {
      conteoRoles["Sin rol"] = (conteoRoles["Sin rol"] || 0) + 1;
      return;
    }

    const rolesUnicos = [
      ...new Set(
        rolesUsuario.map(rol =>
          normalizar(rol.nombre_rol, "Sin rol")
        )
      ),
    ];

    rolesUnicos.forEach(nombreRol => {
      conteoRoles[nombreRol] = (conteoRoles[nombreRol] || 0) + 1;
    });
  });

  const roles = Object.entries(conteoRoles)
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total);

  const dibujarPanel = (x, panelY, ancho, titulo, alto = altoPanel) => {
    doc
      .roundedRect(x, panelY, ancho, alto, 7)
      .fillAndStroke(colorFondo, colorBorde);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(colorTexto)
      .text(titulo, x + 10, panelY + 9, {
        width: ancho - 20,
        ellipsis: true,
      });
  };

  const dibujarBarras = (
    registros,
    x,
    panelY,
    ancho,
    colores,
    alto = altoPanel,
    maxFilas = 5
  ) => {
    const visibles = registros.slice(0, maxFilas);

    if (visibles.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(colorSecundario)
        .text("No hay datos para representar.", x + 10, panelY + 48, {
          width: ancho - 20,
        });

      return;
    }

    const maximo = Math.max(...visibles.map(item => item.total), 1);
    const totalRegistros = data.length;
    const etiquetaX = x + 10;
    const anchoEtiqueta = ancho < anchoContenido ? 82 : 105;
    const barraX = etiquetaX + anchoEtiqueta + 4;
    const anchoBarra = Math.max(ancho - anchoEtiqueta - 70, 20);
    const altoBarra = 7;
    const inicioY = panelY + 31;
    const saltoY = Math.min(13, (alto - 38) / visibles.length);

    visibles.forEach((item, index) => {
      const filaY = inicioY + index * saltoY;
      const anchoRelleno = (item.total / maximo) * anchoBarra;
      const porcentaje = totalRegistros
        ? Math.round((item.total / totalRegistros) * 100)
        : 0;

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(colorTexto)
        .text(item.nombre, etiquetaX, filaY - 1, {
          width: anchoEtiqueta,
          height: 9,
          ellipsis: true,
        });

      doc
        .roundedRect(barraX, filaY, anchoBarra, altoBarra, 3)
        .fill(colorBarraFondo);

      if (anchoRelleno > 0) {
        const color = Array.isArray(colores)
          ? colores[index % colores.length]
          : colores[item.nombre.toLowerCase()] || "#94A3B8";

        doc
          .roundedRect(barraX, filaY, Math.max(anchoRelleno, 2), altoBarra, 3)
          .fill(color);
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(colorTexto)
        .text(`${item.total} (${porcentaje}%)`, barraX + anchoBarra + 4, filaY - 1, {
          width: 40,
        });
    });
  };

  // Primera fila: nivel de estudio y género
  dibujarPanel(margen, y, anchoPanel, "Usuarios por nivel de estudio");
  dibujarBarras(niveles, margen, y, anchoPanel, coloresNivel);

  const xGenero = margen + anchoPanel + separacion;
  dibujarPanel(xGenero, y, anchoPanel, "Usuarios por género");
  dibujarBarras(generos, xGenero, y, anchoPanel, coloresGenero);

  // Segunda fila: roles
  const yRoles = y + altoPanel + 12;
  const altoPanelRoles = 100;

  dibujarPanel(
    margen,
    yRoles,
    anchoContenido,
    "Usuarios por rol",
    altoPanelRoles
  );

  dibujarBarras(
    roles,
    margen,
    yRoles,
    anchoContenido,
    coloresRol,
    altoPanelRoles,
    5
  );
};


const generarTablaParticipaciones = (doc, data, y, agregarFooter) => {
  const startX = 40;
  const tableWidth = doc.page.width - 80;

  const colN = 40;
  const colDocumento = 100;
  const colParticipante = 150;
  const colCorreo = 150;
  const colEdicion = 120;
  const colCategoria = 120;
  const colNota =
    tableWidth -
    (colN +
      colDocumento +
      colParticipante +
      colCorreo +
      colEdicion +
      colCategoria);

  doc
    .moveTo(startX, y + 32)
    .lineTo(startX + tableWidth, y + 32)
    .lineWidth(1)
    .strokeColor("#D1D5DB")
    .stroke();

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151");

  let x = startX;

  doc.text("N°", x + 5, y + 10, {
    width: colN,
    align: "center",
  });

  x += colN;

  doc.text("Documento", x, y + 10, {
    width: colDocumento,
  });

  x += colDocumento;

  doc.text("Participante", x, y + 10, {
    width: colParticipante,
  });

  x += colParticipante;

  doc.text("Correo electrónico", x, y + 10, {
    width: colCorreo,
  });

  x += colCorreo;

  doc.text("Edición", x, y + 10, {
    width: colEdicion,
  });

  x += colEdicion;

  doc.text("Categoría", x, y + 10, {
    width: colCategoria,
  });

  x += colCategoria;

  doc.text("Nota", x, y + 10, {
    width: colNota,
    align: "center",
  });

  y += 28;

  data.forEach((p, index) => {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 60;
    }

    if (index % 2 === 0) {
      doc.rect(startX, y, tableWidth, 30).fill("#FAFAFA");
    }

    doc.font("Helvetica").fontSize(9).fillColor("#111827");

    let x = startX;

    doc.text(String(index + 1), x + 5, y + 10, {
      width: colN,
      align: "center",
    });

    x += colN;

    doc.text(
      `${p.usuario.tipo_documento} ${p.usuario.numero_documento}`,
      x,
      y + 10,
      {
        width: colDocumento,
      },
    );

    x += colDocumento;

    const nombre = [
      p.usuario.primer_nombre,
      p.usuario.segundo_nombre,
      p.usuario.primer_apellido,
      p.usuario.segundo_apellido,
    ]
      .filter((nombre) => nombre && String(nombre).toLowerCase() !== "null")
      .join(" ");

    doc.text(nombre, x, y + 10, {
      width: colParticipante,
    });

    x += colParticipante;

    doc.text(p.usuario.correo_electronico || "—", x, y + 10, {
      width: colCorreo,
    });

    x += colCorreo;

    doc.text(capitalize(p.edicion.nombre_edicion) || "—", x, y + 15, {
      width: colEdicion,
    });

    x += colEdicion;

    doc.text(
      capitalize(p.edicionCategoria.categoria.nombre_categoria) || "—",
      x,
      y + 15,
      {
        width: colCategoria,
      },
    );

    x += colCategoria;

    doc.text(String(p.calificacion_final ?? "—"), x, y + 10, {
      width: colNota,
      align: "center",
    });

    y += 32;
  });
};

const generarTablaPostulaciones = (doc, data, y, agregarFooter) => {
  y += 55;

  const startX = 40;
  const tableWidth = doc.page.width - 80;

  const colN = 40;
  const colDocumento = 100;
  const colParticipante = 150;
  const colCorreo = 150;
  const colEdicion = 120;
  const colCategoria = 120;
  const colEstado =
    tableWidth -
    (colN +
      colDocumento +
      colParticipante +
      colCorreo +
      colEdicion +
      colCategoria);

  doc
    .moveTo(startX, y + 32)
    .lineTo(startX + tableWidth, y + 32)
    .lineWidth(1)
    .strokeColor("#D1D5DB")
    .stroke();

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151");

  let x = startX;

  doc.text("N°", x + 5, y + 10, {
    width: colN,
    align: "center",
  });

  x += colN;

  doc.text("Documento", x, y + 10, {
    width: colDocumento,
  });

  x += colDocumento;

  doc.text("Participante", x, y + 10, {
    width: colParticipante,
  });

  x += colParticipante;

  doc.text("Correo electrónico", x, y + 10, {
    width: colCorreo,
  });

  x += colCorreo;

  doc.text("Edición", x, y + 10, {
    width: colEdicion,
  });

  x += colEdicion;

  doc.text("Categoría", x, y + 10, {
    width: colCategoria,
  });

  x += colCategoria;

  doc.text("Estado", x, y + 15, {
    width: colEstado,
    align: "center",
  });

  y += 28;

  data.forEach((p, index) => {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 60;
    }

    if (index % 2 === 0) {
      doc.rect(startX, y, tableWidth, 30).fill("#FAFAFA");
    }

    doc.font("Helvetica").fontSize(9).fillColor("#111827");

    let x = startX;

    doc.text(String(index + 1), x + 5, y + 10, {
      width: colN,
      align: "center",
    });

    x += colN;

    doc.text(
      `${p.usuario.tipo_documento} ${p.usuario.numero_documento}`,
      x,
      y + 10,
      {
        width: colDocumento,
      },
    );

    x += colDocumento;

    const nombre = [
      p.usuario.primer_nombre,
      p.usuario.segundo_nombre,
      p.usuario.primer_apellido,
      p.usuario.segundo_apellido,
    ]
      .filter((nombre) => nombre && String(nombre).toLowerCase() !== "null")
      .join(" ");

    doc.text(nombre, x, y + 10, {
      width: colParticipante,
    });

    x += colParticipante;

    doc.text(p.usuario.correo_electronico || "—", x, y + 10, {
      width: colCorreo,
    });

    x += colCorreo;

    doc.text(
      capitalize(p.edicionCategoria.edicion.nombre_edicion) || "—",
      x,
      y + 15,
      {
        width: colEdicion,
      },
    );

    x += colEdicion;

    doc.text(
      capitalize(p.edicionCategoria.categoria.nombre_categoria) || "—",
      x,
      y + 15,
      {
        width: colCategoria,
      },
    );

    x += colCategoria;

    doc.text(capitalize(p.estado ?? "—"), x, y + 10, {
      width: colEstado,
      align: "center",
    });

    y += 32;
  });
};

const generarTablaConvocatorias = (doc, data, y, agregarFooter) => {
  const startX = 40;
  const tableWidth = doc.page.width - 80;

  const columnas = [
    { titulo: "N°", ancho: 35, alinear: "center" },
    { titulo: "Correo electrónico", ancho: tableWidth * 0.29 },
    { titulo: "Edición", ancho: tableWidth * 0.25 },
    { titulo: "Fecha de envío", ancho: tableWidth * 0.17 },
    { titulo: "Estado", ancho: tableWidth * 0.13 },
    { titulo: "N.º envíos", ancho: 0 },
  ];

  const anchoAsignado = columnas
    .slice(0, -1)
    .reduce((total, columna) => total + columna.ancho, 0);

  columnas[columnas.length - 1].ancho = tableWidth - anchoAsignado;

  const altoFila = 30;
  const altoEncabezado = 32;
  const margenInferior = 110;

  const dibujarEncabezado = (posY) => {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#374151");

    let x = startX;

    columnas.forEach((columna) => {
      doc.text(columna.titulo, x + 4, posY + 10, {
        width: columna.ancho - 8,
        align: columna.alinear || "left",
        ellipsis: true,
      });

      x += columna.ancho;
    });

    doc
      .moveTo(startX, posY + altoEncabezado)
      .lineTo(startX + tableWidth, posY + altoEncabezado)
      .lineWidth(1)
      .strokeColor("#D1D5DB")
      .stroke();
  };

  const dibujarFila = (convocatoria, index, posY) => {
    if (index % 2 === 0) {
      doc.rect(startX, posY, tableWidth, altoFila).fill("#FAFAFA");
    }

    doc.font("Helvetica").fontSize(8).fillColor("#111827");

    const valores = [
      String(index + 1),
      convocatoria.correo_electronico || "—",
      capitalizarNombre(convocatoria.edicion?.nombre_edicion || "Sin edición"),
      convocatoria.fecha_envio
        ? dayjs(convocatoria.fecha_envio).format("DD/MM/YYYY")
        : "—",
      capitalizarNombre(convocatoria.estado_envio || "Sin estado"),
      String(convocatoria.intentos_envio ?? 0),
    ];

    let x = startX;

    columnas.forEach((columna, columnaIndex) => {
      doc.text(valores[columnaIndex], x + 4, posY + 9, {
        width: columna.ancho - 8,
        align: columna.alinear || "left",
        ellipsis: true,
      });

      x += columna.ancho;
    });
  };

  // Encabezado inicial
  dibujarEncabezado(y);
  y += altoEncabezado;

  data.forEach((convocatoria, index) => {
    // Si no cabe otra fila, crear página y repetir encabezado.
    if (y + altoFila > doc.page.height - margenInferior) {
      doc.addPage();
      y = 40;
      dibujarEncabezado(y);
      y += altoEncabezado;
    }

    dibujarFila(convocatoria, index, y);
    y += altoFila;
  });
};

const generarTablaUsuarios = (doc, data, y, agregarFooter) => {
  y += 55;

  doc
    .moveTo(40, y + 32)
    .lineTo(555, y + 32)
    .lineWidth(1)
    .strokeColor("#D1D5DB")
    .stroke();

  doc.fillColor("#111827");

  doc.font("Helvetica-Bold").fontSize(10);

  doc.fillColor("#374151");

  doc.font("Helvetica-Bold").fontSize(10);

  doc.text("N°", 45, y + 10);
  doc.text("Documento", 65, y + 10);
  doc.text("Participante", 150, y + 10);
  doc.text("Correo electrónico", 290, y + 10);
  doc.text("Código", 420, y + 10);
  doc.text("Nivel de Estudio", 470, y + 10);

  y += 28;

  doc.font("Helvetica").fontSize(9);

  data.forEach((p, index) => {
    if (y > 690) {
      doc.addPage();
      y = 60;
    }

    if (index % 2 === 0) {
      doc.rect(40, y, 515, 30).fill("#FAFAFA");
    }

    doc.fillColor("#111827");

    doc.font("Helvetica").fontSize(9);

    doc.text(String(index + 1), 45, y + 10);
    doc.text(`${p.tipo_documento} ${p.numero_documento}`, 65, y + 10, {
      width: 85,
    });
    doc.text(
      `${p.primer_nombre || ""} ${p.segundo_nombre || ""} ${p.primer_apellido || ""} ${p.segundo_apellido || ""}`,
      150,
      y + 10,
      {
        width: 145,
      },
    );
    doc.text(p.correo_electronico, 285, y + 10, {
      width: 120,
    });
    doc.text(p.codigo_institucional || "N/A", 425, y + 10, {
      width: 140,
    });

    doc.text(capitalize(p.nivel_estudio_superior), 480, y + 10, {
      width: 140,
    });

    y += 32;
  });
};

const capitalize = (text) => {
  if (text === null || text === undefined || text === "") {
    return "N/A";
  }

  const value = String(text);

  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatearTexto = (texto) => {
  return texto
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

module.exports = {
  generarPDF,
};

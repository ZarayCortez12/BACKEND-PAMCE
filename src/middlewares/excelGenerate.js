const ExcelJS = require("exceljs");
const path = require("path");
const dayjs = require("dayjs");

// Devuelve "" si no hay valor: varios campos son opcionales (por ejemplo,
// jurados y administradores no tienen nivel educativo) y antes el Excel
// fallaba con error 500
const capitalize = (text) => {
  if (text === null || text === undefined || text === "") return "";
  const valor = String(text);
  return valor.charAt(0).toUpperCase() + valor.slice(1);
};

const configuracionesReportes = {
  participaciones: {
    columnas: [
      {
        header: "Documento",
        key: "documento",
        width: 20,
      },
      {
        header: "Participante",
        key: "participante",
        width: 35,
      },
      {
        header: "Correo electrónico",
        key: "correo",
        width: 35,
      },
      {
        header: "Edición",
        key: "edicion",
        width: 25,
      },
      {
        header: "Categoría",
        key: "categoria",
        width: 25,
      },
      {
        header: "Nota",
        key: "nota",
        width: 20,
      },
    ],

    transformarDatos: (registros) =>
      registros.map((p) => ({
        documento: `${p.usuario.tipo_documento} ${p.usuario.numero_documento}`,

        participante:
          `${p.usuario.primer_nombre} ` +
          `${p.usuario.segundo_nombre || ""} ` +
          `${p.usuario.primer_apellido} ` +
          `${p.usuario.segundo_apellido || ""}`,

        correo: p.usuario.correo_electronico,

        edicion: capitalize(p.edicion?.nombre_edicion) || "Sin edición",

        categoria:
          capitalize(p.edicionCategoria?.categoria?.nombre_categoria) ||
          "Sin categoría",

        nota: p.calificacion_final || 0,
      })),
  },
  postulaciones: {
    columnas: [
      {
        header: "Documento",
        key: "documento",
        width: 20,
      },
      {
        header: "Participante",
        key: "participante",
        width: 35,
      },
      {
        header: "Correo electrónico",
        key: "correo",
        width: 35,
      },
      {
        header: "Edición",
        key: "edicion",
        width: 25,
      },
      {
        header: "Categoría",
        key: "categoria",
        width: 25,
      },
      {
        header: "Estado",
        key: "estado",
        width: 20,
      },
    ],

    transformarDatos: (registros) =>
      registros.map((p) => ({
        documento: `${p.usuario.tipo_documento} ${p.usuario.numero_documento}`,

        participante:
          `${capitalize(p.usuario.primer_nombre)} ` +
          `${capitalize(p.usuario.segundo_nombre || "")} ` +
          `${capitalize(p.usuario.primer_apellido)} ` +
          `${capitalize(p.usuario.segundo_apellido || "")}`,

        correo: p.usuario.correo_electronico,

        edicion:
          capitalize(p.edicionCategoria?.edicion?.nombre_edicion) ||
          "Sin edición",

        categoria:
          capitalize(p.edicionCategoria?.categoria?.nombre_categoria) ||
          "Sin categoría",

        estado: capitalize(p.estado) || "Sin estado",
      })),
  },
  convocatorias: {
    columnas: [
      {
        header: "Correo Electrónico",
        key: "correo_electronico",
        width: 35,
      },
      {
        header: "Edicion",
        key: "edicion",
        width: 30,
      },
      {
        header: "Fecha de Envio",
        key: "fecha_envio",
        width: 20,
      },
      {
        header: "Fecha de Respuesta",
        key: "fecha_respuesta",
        width: 25,
      },
      {
        header: "Número de Envíos",
        key: "numero_envios",
        width: 15,
      },
      {
        header: "Estado",
        key: "estado",
        width: 20,
      },
    ],

    transformarDatos: (registros) =>
      registros.map((p) => ({
        correo_electronico: `${p.correo_electronico}`,

        edicion: capitalize(p.edicion?.nombre_edicion) || "Sin edición",

        fecha_envio:
          p.fecha_envio && dayjs(p.fecha_envio).isValid()
            ? dayjs(p.fecha_envio).format("DD/MM/YYYY")
            : "Sin fecha",

        fecha_respuesta:
          p.fecha_respuesta && dayjs(p.fecha_respuesta).isValid()
            ? dayjs(p.fecha_respuesta).format("DD/MM/YYYY")
            : "Sin fecha",

        numero_envios: p.intentos_envio || "Sin envíos",

        estado: capitalize(p.estado_envio) || "Sin estado",
      })),
  },
  usuarios: {
    columnas: [
      {
        header: "Documento",
        key: "documento",
        width: 20,
      },
      {
        header: "Nombres",
        key: "nombres",
        width: 30,
      },
      {
        header: "Apellidos",
        key: "apellidos",
        width: 30,
      },
      {
        header: "Correo electrónico",
        key: "correo",
        width: 35,
      },
      {
        header: "Código Inst.",
        key: "codigo",
        width: 25,
      },
      {
        header: "Nivel de Estudio",
        key: "nivel_estudio",
        width: 25,
      },
    ],

    transformarDatos: (registros) =>
      registros.map((p) => ({
        documento: `${p.tipo_documento} ${p.numero_documento}`,

        nombres:
          `${capitalize(p.primer_nombre)} ` +
          `${capitalize(p.segundo_nombre || "")} `,

        apellidos:
          `${capitalize(p.primer_apellido)} ` +
          `${capitalize(p.segundo_apellido || "")}`,

        correo: p.correo_electronico,
        codigo: p.codigo_institucional || "N/A",
        nivel_estudio: capitalize(p.nivel_estudio_superior) || "N/A",
      })),
  },
};

const generarExcel = async (
  tipoReporte,
  registros,
  fecha,
  filtros = {},
  res,
) => {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "PAMCE";
  workbook.company = "UFPS";
  workbook.created = new Date();

  const configuracion = configuracionesReportes[tipoReporte];

  if (!configuracion) {
    throw new Error("Tipo de reporte no soportado");
  }

  const worksheet = workbook.addWorksheet(`Reporte ${tipoReporte}`);

  worksheet.properties.defaultRowHeight = 18;

  const datos = configuracion.transformarDatos(registros);

  worksheet.columns = configuracion.columnas.map((col) => ({
    key: col.key,
    width: col.width,
  }));

  const logoUniversidad = path.join(__dirname, "../images/logo_entidad.png");

  const logoIng = path.join(__dirname, "../images/logo-ing-sistemas.png");

  const logoUniversidadId = workbook.addImage({
    filename: logoUniversidad,
    extension: "png",
  });

  const logoIngId = workbook.addImage({
    filename: logoIng,
    extension: "png",
  });

  worksheet.addImage(logoUniversidadId, {
    tl: { col: 0.2, row: 0.3 },
    ext: { width: 130, height: 90 },
  });

  worksheet.addImage(logoIngId, {
    tl: { col: configuracion.columnas.length - 1, row: 0.45 },
    ext: { width: 145, height: 85 },
  });

  worksheet.getRow(1).height = 15;
  worksheet.getRow(2).height = 35;
  worksheet.getRow(3).height = 25;
  worksheet.getRow(4).height = 15;

  for (let row = 1; row <= 4; row++) {
    for (let col = 1; col <= configuracion.columnas.length; col++) {
      const cell = worksheet.getCell(row, col);

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFF" },
      };

      cell.border = {
        top: {
          style: "thin",
          color: { argb: "D1D5DB" },
        },
        left: {
          style: "thin",
          color: { argb: "D1D5DB" },
        },
        bottom: {
          style: "thin",
          color: { argb: "D1D5DB" },
        },
        right: {
          style: "thin",
          color: { argb: "D1D5DB" },
        },
      };
    }
  }

  worksheet.mergeCells("B2:E2");

  const titulo = worksheet.getCell("B2");

  titulo.value = `REPORTE DE ${tipoReporte.toUpperCase()}`;

  titulo.font = {
    name: "Arial",
    size: 18,
    bold: true,
    color: { argb: "1F2937" },
  };

  titulo.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.mergeCells("B3:E3");

  const subtituloCell = worksheet.getCell("B3");

  subtituloCell.value =
    "Sistema de Reportes PAMCE - Universidad Francisco de Paula Santander";

  subtituloCell.font = {
    name: "Arial",
    size: 10,
    color: { argb: "6B7280" },
  };

  subtituloCell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  let currentRow = 5;

  worksheet.mergeCells(`A${currentRow}:D${currentRow}`);

  const filtrosTitle = worksheet.getCell(`A${currentRow}`);

  filtrosTitle.value = "FILTROS APLICADOS";

  filtrosTitle.font = {
    bold: true,
    size: 12,
    color: { argb: "991B1B" },
  };

  filtrosTitle.alignment = {
    vertical: "middle",
  };

  worksheet.getCell(`E${currentRow}`).value = "Fecha";

  worksheet.getCell(`E${currentRow}`).font = {
    bold: true,
  };

  worksheet.getCell(`F${currentRow}`).value = fecha;

  worksheet.getRow(currentRow).height = 20;

  currentRow++;

  const filtrosAplicados = Object.entries(filtros).filter(
    ([key, value]) => value && key !== "page",
  );

  if (filtrosAplicados.length > 0) {
    filtrosAplicados.forEach(([key, value]) => {
      worksheet.getCell(`A${currentRow}`).value = formatearTexto(key);

      worksheet.getCell(`A${currentRow}`).font = {
        bold: true,
      };

      worksheet.getCell(`B${currentRow}`).value = value;

      worksheet.getRow(currentRow).height = 18;

      currentRow++;
    });
  } else {
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);

    const noFiltros = worksheet.getCell(`A${currentRow}`);

    noFiltros.value = "No hay filtros aplicados";

    noFiltros.font = {
      italic: true,
      color: { argb: "6B7280" },
    };

    noFiltros.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getRow(currentRow).height = 18;

    currentRow++;
  }

  currentRow++;

  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);

  const resultadosTitle = worksheet.getCell(`A${currentRow}`);

  resultadosTitle.value = "RESULTADOS DEL REPORTE";

  resultadosTitle.font = {
    bold: true,
    size: 13,
    color: { argb: "991B1B" },
  };

  resultadosTitle.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.getRow(currentRow).height = 22;

  currentRow++;

  const headerRow = worksheet.getRow(currentRow);

  configuracion.columnas.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);

    cell.value = column.header;

    cell.font = {
      bold: true,
      color: { argb: "FFFFFF" },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "991B1B" },
    };

    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };

    cell.border = bordeGeneral();
  });

  headerRow.height = 28;

  currentRow++;

  datos.forEach((registro, index) => {
    const row = worksheet.getRow(currentRow);

    configuracion.columnas.forEach((column, colIndex) => {
      const cell = row.getCell(colIndex + 1);

      cell.value = registro[column.key];

      cell.border = bordeGeneral();

      cell.alignment = {
        vertical: "middle",
        wrapText: true,
      };

      if (index % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9FAFB" },
        };
      }
    });

    row.height = 20;

    currentRow++;
  });

  worksheet.views = [
    {
      state: "frozen",
      ySplit: currentRow > 0 ? 11 : 0,
    },
  ];

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=reporte_${tipoReporte}.xlsx`,
  );

  await workbook.xlsx.write(res);

  res.end();
};

const formatearTexto = (texto) => {
  return texto
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/(?<!\p{L})\p{L}/gu, (l) => l.toUpperCase());
};

const bordeGeneral = () => ({
  top: {
    style: "thin",
    color: { argb: "E5E7EB" },
  },
  left: {
    style: "thin",
    color: { argb: "E5E7EB" },
  },
  bottom: {
    style: "thin",
    color: { argb: "E5E7EB" },
  },
  right: {
    style: "thin",
    color: { argb: "E5E7EB" },
  },
});

module.exports = {
  generarExcel,
};

const cron = require("node-cron");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const sequelize = require("../configs/db");
const { QueryTypes } = require("sequelize");
const HistoricoEdicion = require("../models/historicoEdicionModel");

const {
  listarEdicionesElegibles,
  generarSnapshotEdicion,
  validarSnapshotEdicion,
  archivarEdicion,
} = require("../utils/historicoEdicionesService");

const BACKEND_ROOT = path.resolve(__dirname, "..");
const DOCUMENTOS_ROOT = path.resolve(BACKEND_ROOT, "documentos");

let ejecucionEnCurso = false;

const calcularChecksum = (datos) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(datos), "utf8")
    .digest("hex");

const calcularTamanoJson = (datos) =>
  Buffer.byteLength(JSON.stringify(datos), "utf8");

function normalizarObjeto(valor) {
  if (Array.isArray(valor)) {
    return valor.map(normalizarObjeto);
  }

  if (valor && typeof valor === "object") {
    return Object.keys(valor)
      .sort()
      .reduce((resultado, clave) => {
        if (clave !== "generado_en") {
          resultado[clave] = normalizarObjeto(valor[clave]);
        }

        return resultado;
      }, {});
  }

  return valor;
}

function compararSnapshots(snapshotActual, snapshotHistorico) {
  return (
    JSON.stringify(normalizarObjeto(snapshotActual)) ===
    JSON.stringify(normalizarObjeto(snapshotHistorico))
  );
}

async function verificarHistorico(historico) {
  if (!historico) {
    throw new Error("No existe el registro histórico.");
  }

  const checksum = calcularChecksum(historico.datos);
  const tamano = calcularTamanoJson(historico.datos);

  if (checksum !== historico.checksum) {
    throw new Error("El checksum del histórico no coincide.");
  }

  if (tamano !== Number(historico.tamano_json_bytes)) {
    throw new Error("El tamaño del JSON no coincide.");
  }

  if (
    !historico.datos?.edicion ||
    Number(historico.datos.metadata?.id_edicion) !==
      Number(historico.id_edicion)
  ) {
    throw new Error("La estructura o el ID del histórico no es válido.");
  }

  return true;
}

function obtenerRutasDocumentos(datos) {
  return [
    ...new Set(
      (datos?.respuestas_requisitos || [])
        .map((respuesta) => respuesta.ruta_archivo)
        .filter((ruta) => typeof ruta === "string" && ruta.trim() !== ""),
    ),
  ];
}

async function resolverArchivoSeguro(rutaRegistrada) {
  if (
    typeof rutaRegistrada !== "string" ||
    !rutaRegistrada.trim() ||
    path.isAbsolute(rutaRegistrada)
  ) {
    throw new Error("La ruta registrada no es válida.");
  }

  const rutaNormalizada = rutaRegistrada.replace(/\\/g, "/");

  const rutaAbsoluta = path.resolve(BACKEND_ROOT, rutaNormalizada);

  const relativaDocumentos = path.relative(DOCUMENTOS_ROOT, rutaAbsoluta);

  if (
    !relativaDocumentos ||
    relativaDocumentos === "." ||
    relativaDocumentos.startsWith(`..${path.sep}`) ||
    relativaDocumentos === ".." ||
    path.isAbsolute(relativaDocumentos)
  ) {
    throw new Error(
      "La ruta no pertenece a la carpeta de documentos autorizada.",
    );
  }

  const info = await fs.lstat(rutaAbsoluta);

  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error("La ruta no corresponde a un archivo regular autorizado.");
  }

  const raizReal = await fs.realpath(DOCUMENTOS_ROOT);
  const archivoReal = await fs.realpath(rutaAbsoluta);

  const relativaReal = path.relative(raizReal, archivoReal);

  if (
    !relativaReal ||
    relativaReal === ".." ||
    relativaReal.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativaReal)
  ) {
    throw new Error(
      "La ubicación física del archivo está fuera de documentos.",
    );
  }

  return {
    rutaAbsoluta,
    tamanoBytes: info.size,
  };
}

async function eliminarDocumentosHistoricos(historico) {
  const rutas = obtenerRutasDocumentos(historico.datos);
  const errores = [];
  let bytesEliminados = 0;

  for (const ruta of rutas) {
    try {
      const archivo = await resolverArchivoSeguro(ruta);

      await fs.unlink(archivo.rutaAbsoluta);

      bytesEliminados += archivo.tamanoBytes;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.warn(`[ARCHIVADO] Documento inexistente: ${ruta}`);
        continue;
      }

      errores.push({
        ruta_archivo: ruta,
        error: error.message,
      });

      console.error(`[ARCHIVADO] No se pudo eliminar ${ruta}:`, error.message);
    }
  }

  const bytesAnteriores = Number(historico.bytes_documentos_liberados || 0);

  await historico.update({
    bytes_documentos_liberados: bytesAnteriores + bytesEliminados,
    archivos_no_eliminados: errores,
  });

  return {
    totalRutas: rutas.length,
    bytesEliminados,
    errores,
  };
}

async function eliminarDatosOperativos(idEdicion) {
  const transaction = await sequelize.transaction();

  try {
    const [edicion] = await sequelize.query(
      `
        SELECT
          id_edicion,
          fecha_fin,
          fecha_fin <=
            (CURRENT_DATE - INTERVAL '5 years')::DATE AS elegible
        FROM ediciones
        WHERE id_edicion = :idEdicion
        FOR UPDATE;
      `,
      {
        replacements: { idEdicion },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (!edicion) {
      await transaction.rollback();
      return false;
    }

    if (!edicion.elegible) {
      throw new Error("La edición ya no cumple el requisito de antigüedad.");
    }

    const historico = await HistoricoEdicion.findOne({
      where: { id_edicion: idEdicion },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    await verificarHistorico(historico);

    await sequelize.query(
      `
        DELETE FROM participacion_requisito pr
        WHERE pr.id_participacion IN (
          SELECT p.id_participacion
          FROM participacion p
          WHERE p.id_edicion = :idEdicion
        )
        OR pr.id_requisito_edicion IN (
          SELECT re.id_requisito_edicion
          FROM requisito_edicion re
          WHERE re.id_edicion = :idEdicion
        )
        OR pr.id_requisito_edicion_categoria IN (
          SELECT rec.id_requisito_edicion_categoria
          FROM requisito_edicion_categoria rec
          INNER JOIN edicion_categoria ec
            ON ec.id_edicion_categoria =
               rec.id_edicion_categoria
          WHERE ec.id_edicion = :idEdicion
        );
      `,
      {
        replacements: { idEdicion },
        transaction,
      },
    );

    await sequelize.query(
      `
        DELETE FROM participacion
        WHERE id_edicion = :idEdicion;
      `,
      {
        replacements: { idEdicion },
        transaction,
      },
    );

    await sequelize.query(
      `
        DELETE FROM ediciones
        WHERE id_edicion = :idEdicion;
      `,
      {
        replacements: { idEdicion },
        transaction,
      },
    );

    const [resultado] = await sequelize.query(
      `
        SELECT COUNT(*)::INTEGER AS total
        FROM ediciones
        WHERE id_edicion = :idEdicion;
      `,
      {
        replacements: { idEdicion },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (Number(resultado.total) !== 0) {
      throw new Error("La edición todavía existe después de la eliminación.");
    }

    await transaction.commit();

    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function procesarEdicion(idEdicion) {
  let historico = await HistoricoEdicion.findOne({
    where: { id_edicion: idEdicion },
  });

  if (!historico) {
    const resultado = await archivarEdicion(idEdicion);

    historico = await HistoricoEdicion.findOne({
      where: { id_edicion: idEdicion },
    });
  }

  await verificarHistorico(historico);

  const edicionOperativa = await sequelize.query(
    `
      SELECT id_edicion
      FROM ediciones
      WHERE id_edicion = :idEdicion
        AND fecha_fin <=
          (CURRENT_DATE - INTERVAL '5 years')::DATE;
    `,
    {
      replacements: { idEdicion },
      type: QueryTypes.SELECT,
    },
  );

  if (!edicionOperativa.length) {
    const limpieza = await eliminarDocumentosHistoricos(historico);

    return;
  }

  const snapshot = await generarSnapshotEdicion(idEdicion);
  const validacion = await validarSnapshotEdicion(snapshot);

  if (!validacion.valido) {
    throw new Error(
      `La edición ${idEdicion} presenta diferencias en sus cantidades.`,
    );
  }

  if (!compararSnapshots(snapshot, historico.datos)) {
    throw new Error(
      `El snapshot actual de la edición ${idEdicion} no coincide con el histórico guardado.`,
    );
  }

  await eliminarDatosOperativos(idEdicion);

  historico = await HistoricoEdicion.findOne({
    where: { id_edicion: idEdicion },
  });

  const limpieza = await eliminarDocumentosHistoricos(historico);
}

async function reintentarLimpiezasPendientes() {
  const pendientes = await sequelize.query(
    `
      SELECT h.id_edicion
      FROM historico_ediciones h
      WHERE h.archivos_no_eliminados <> '[]'::JSON
      ORDER BY h.fecha_archivado ASC;
    `,
    { type: QueryTypes.SELECT },
  );

  for (const pendiente of pendientes) {
    try {
      const historico = await HistoricoEdicion.findOne({
        where: { id_edicion: pendiente.id_edicion },
      });

      if (!historico) continue;

      await verificarHistorico(historico);

      const limpieza = await eliminarDocumentosHistoricos(historico);
    } catch (error) {
      console.error(
        `[ARCHIVADO] Error reintentando archivos de edición ${pendiente.id_edicion}:`,
        error.message,
      );
    }
  }
}

async function procesarArchivadoEdiciones() {
  if (ejecucionEnCurso) {
    console.warn("[ARCHIVADO] Ya hay una ejecución en curso.");
    return;
  }

  ejecucionEnCurso = true;

  try {
    const ediciones = await listarEdicionesElegibles();

    for (const edicion of ediciones) {
      try {
        await procesarEdicion(Number(edicion.id_edicion));
      } catch (error) {
        console.error(
          `[ARCHIVADO] Edición ${edicion.id_edicion} no procesada:`,
          error.message,
        );
      }
    }

    await reintentarLimpiezasPendientes();
  } catch (error) {
    console.error("[ARCHIVADO] Error general:", error.message);
  } finally {
    ejecucionEnCurso = false;
  }
}

function archivarEdiciones() {
  cron.schedule("0 2 * * *", procesarArchivadoEdiciones, {
    timezone: "America/Bogota",
    noOverlap: true,
  });
}

module.exports = {
  archivarEdiciones,
  procesarArchivadoEdiciones,
};

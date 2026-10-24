const sequelize = require("../configs/db");
const { QueryTypes } = require("sequelize");
const crypto = require("crypto");
const HistoricoEdicion = require("../models/historicoEdicionModel");

const listarEdicionesElegibles = async () => {
  const ediciones = await sequelize.query(
    `
      SELECT
        e.id_edicion,
        e.nombre_edicion,
        e.fecha_inicio,
        e.fecha_fin,
        e.estado_edicion,
        e.fecha_eliminacion,
        (e.fecha_fin + INTERVAL '5 years')::DATE
          AS fecha_elegible_archivado,
        CURRENT_DATE AS fecha_actual
      FROM ediciones e
      WHERE e.fecha_fin <= (
        CURRENT_DATE - INTERVAL '5 years'
      )::DATE
      ORDER BY e.fecha_fin ASC;
    `,
    {
      type: QueryTypes.SELECT,
    },
  );

  return ediciones;
};

const generarSnapshotEdicion = async (idEdicion) => {
  if (!Number.isInteger(Number(idEdicion)) || Number(idEdicion) <= 0) {
    throw new Error("El identificador de la edición no es válido.");
  }

  const edicionId = Number(idEdicion);

  // 1. Consultar los datos generales de la edición.
  const [edicion] = await sequelize.query(
    `
      SELECT *
      FROM ediciones
      WHERE id_edicion = :idEdicion
        AND fecha_fin <= (
          CURRENT_DATE - INTERVAL '5 years'
        )::DATE;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  if (!edicion) {
    throw new Error("La edición no existe o todavía no cumple los cinco años.");
  }

  // 2. Consultar las categorías de esa edición.
  const categorias = await sequelize.query(
    `
      SELECT
        ec.*,
        to_jsonb(c) AS categoria
      FROM edicion_categoria ec
      LEFT JOIN categorias c
        ON c.id_categoria = ec.id_categoria
      WHERE ec.id_edicion = :idEdicion
      ORDER BY ec.id_edicion_categoria;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 3. Consultar las participaciones de esa edición.
  const participaciones = await sequelize.query(
    `
      SELECT *
      FROM participacion
      WHERE id_edicion = :idEdicion
      ORDER BY id_participacion;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 4. Consultar las rúbricas configuradas para las categorías.
  const rubricasCategoria = await sequelize.query(
    `
      SELECT
        ecr.*,
        to_jsonb(r) AS rubrica
      FROM edicion_categoria_rubrica ecr
      INNER JOIN edicion_categoria ec
        ON ec.id_edicion_categoria = ecr.id_edicion_categoria
      LEFT JOIN rubrica r
        ON r.id_rubrica = ecr.id_rubrica
      WHERE ec.id_edicion = :idEdicion
      ORDER BY ecr.id_edicion_categoria, ecr.id_ecr;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 5. Consultar los criterios configurados para las categorías.
  const criteriosCategoria = await sequelize.query(
    `
      SELECT
        ecrc.*,
        to_jsonb(rc) AS rubrica_criterio,
        to_jsonb(r) AS rubrica,
        to_jsonb(c) AS criterio
      FROM edicion_categoria_rubrica_criterio ecrc
      INNER JOIN edicion_categoria ec
        ON ec.id_edicion_categoria = ecrc.id_edicion_categoria
      LEFT JOIN rubrica_criterio rc
        ON rc.id_rubrica_criterio = ecrc.id_rubrica_criterio
      LEFT JOIN rubrica r
        ON r.id_rubrica = rc.id_rubrica
      LEFT JOIN criterio c
        ON c.id_criterio = rc.id_criterio
      WHERE ec.id_edicion = :idEdicion
      ORDER BY
        ecrc.id_edicion_categoria,
        ecrc.id_ecrc;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 6. Consultar los participantes con datos de identificación necesarios.
  const participantes = await sequelize.query(
    `
      SELECT
        p.id_participacion,
        p.id_edicion,
        p.id_edicion_categoria,
        p.id_usuario,
        jsonb_build_object(
          'id_usuario', u.id_usuario,
          'tipo_documento', u.tipo_documento,
          'numero_documento', u.numero_documento,
          'primer_nombre', u.primer_nombre,
          'segundo_nombre', u.segundo_nombre,
          'primer_apellido', u.primer_apellido,
          'segundo_apellido', u.segundo_apellido,
          'correo_electronico', u.correo_electronico
        ) AS participante
      FROM participacion p
      INNER JOIN usuarios u
        ON u.id_usuario = p.id_usuario
      WHERE p.id_edicion = :idEdicion
      ORDER BY p.id_participacion;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 7. Consultar las asignaciones de jurados de la edición.
  const juradosAsignados = await sequelize.query(
    `
      SELECT
        pj.*,
        jsonb_build_object(
          'id_usuario', u.id_usuario,
          'tipo_documento', u.tipo_documento,
          'numero_documento', u.numero_documento,
          'primer_nombre', u.primer_nombre,
          'segundo_nombre', u.segundo_nombre,
          'primer_apellido', u.primer_apellido,
          'segundo_apellido', u.segundo_apellido,
          'correo_electronico', u.correo_electronico
        ) AS jurado
      FROM participacion_jurado pj
      INNER JOIN participacion p
        ON p.id_participacion = pj.id_participacion
      INNER JOIN usuarios u
        ON u.id_usuario = pj.id_jurado
      WHERE p.id_edicion = :idEdicion
      ORDER BY pj.id_participacion_jurado;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 8. Consultar las evaluaciones y los criterios que fueron calificados.
  const evaluaciones = await sequelize.query(
    `
      SELECT
        ev.*,
        pj.id_participacion,
        pj.id_jurado,
        pj.estado AS estado_asignacion_jurado,
        ecrc.id_edicion_categoria,
        ecrc.porcentaje AS porcentaje_criterio_configurado,
        rc.id_rubrica,
        rc.id_criterio,
        c.nombre AS nombre_criterio,
        c.descripcion AS descripcion_criterio
      FROM evaluacion_criterio ev
      INNER JOIN participacion_jurado pj
        ON pj.id_participacion_jurado =
           ev.id_participacion_jurado
      INNER JOIN participacion p
        ON p.id_participacion = pj.id_participacion
      INNER JOIN edicion_categoria_rubrica_criterio ecrc
        ON ecrc.id_ecrc =
           ev.id_edicion_categoria_rubrica_criterio
      LEFT JOIN rubrica_criterio rc
        ON rc.id_rubrica_criterio = ecrc.id_rubrica_criterio
      LEFT JOIN criterio c
        ON c.id_criterio = rc.id_criterio
      WHERE p.id_edicion = :idEdicion
      ORDER BY ev.id_evaluacion_criterio;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 9. Requisitos generales configurados para la edición.
  const requisitosEdicion = await sequelize.query(
    `
      SELECT
        re.*,
        to_jsonb(r) AS requisito
      FROM requisito_edicion re
      LEFT JOIN requisitos r
        ON r.id_requisito = re.id_requisito
      WHERE re.id_edicion = :idEdicion
      ORDER BY re.id_requisito_edicion;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 10. Requisitos configurados para las categorías de la edición.
  const requisitosCategoria = await sequelize.query(
    `
      SELECT
        rec.*,
        ec.id_edicion,
        ec.id_categoria,
        to_jsonb(r) AS requisito
      FROM requisito_edicion_categoria rec
      INNER JOIN edicion_categoria ec
        ON ec.id_edicion_categoria = rec.id_edicion_categoria
      LEFT JOIN requisitos r
        ON r.id_requisito = rec.id_requisito
      WHERE ec.id_edicion = :idEdicion
      ORDER BY rec.id_requisito_edicion_categoria;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 11. Configuración de requisitos generales.
  const configuracionRequisitos = await sequelize.query(
    `
      SELECT
        cfg.*,
        re.id_edicion,
        re.id_requisito
      FROM requisito_config cfg
      INNER JOIN requisito_edicion re
        ON re.id_requisito_edicion = cfg.id_requisito_edicion
      WHERE re.id_edicion = :idEdicion
      ORDER BY cfg.id_config;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 12. Configuración de requisitos por categoría.
  const configuracionRequisitosCategoria = await sequelize.query(
    `
      SELECT
        cfg.*,
        rec.id_edicion_categoria,
        rec.id_requisito
      FROM requisito_categoria_config cfg
      INNER JOIN requisito_edicion_categoria rec
        ON rec.id_requisito_edicion_categoria =
           cfg.id_requisito_edicion_categoria
      INNER JOIN edicion_categoria ec
        ON ec.id_edicion_categoria = rec.id_edicion_categoria
      WHERE ec.id_edicion = :idEdicion
      ORDER BY cfg.id_config;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  // 13. Respuestas y documentos entregados por los participantes.
  const respuestasRequisitos = await sequelize.query(
    `
      SELECT
        pr.*,
        COALESCE(
          re.id_requisito,
          rec.id_requisito
        ) AS id_requisito,
        COALESCE(
          re.obligatorio,
          rec.obligatorio
        ) AS requisito_obligatorio,
        COALESCE(
          re.tipo_requisito,
          rec.tipo_requisito
        ) AS tipo_requisito_configurado,
        r.descripcion AS descripcion_requisito
      FROM participacion_requisito pr
      INNER JOIN participacion p
        ON p.id_participacion = pr.id_participacion
      LEFT JOIN requisito_edicion re
        ON re.id_requisito_edicion = pr.id_requisito_edicion
      LEFT JOIN requisito_edicion_categoria rec
        ON rec.id_requisito_edicion_categoria =
           pr.id_requisito_edicion_categoria
      LEFT JOIN requisitos r
        ON r.id_requisito = COALESCE(
          re.id_requisito,
          rec.id_requisito
        )
      WHERE p.id_edicion = :idEdicion
      ORDER BY pr.id_participacion_requisito;
    `,
    {
      replacements: { idEdicion: edicionId },
      type: QueryTypes.SELECT,
    },
  );

  const snapshot = {
    metadata: {
      version_esquema: 1,
      generado_en: new Date().toISOString(),
      id_edicion: edicionId,
    },
    edicion,
    categorias,
    participaciones,
    rubricas_categoria: rubricasCategoria,
    criterios_categoria: criteriosCategoria,
    participantes,
    jurados_asignados: juradosAsignados,
    evaluaciones,
    requisitos_edicion: requisitosEdicion,
    requisitos_categoria: requisitosCategoria,
    configuracion_requisitos: configuracionRequisitos,
    configuracion_requisitos_categoria: configuracionRequisitosCategoria,
    respuestas_requisitos: respuestasRequisitos,
  };

  return snapshot;
};

const validarSnapshotEdicion = async (snapshot) => {
  const idEdicion = snapshot.metadata.id_edicion;

  // Consultar los totales directamente en PostgreSQL.
  const [totales] = await sequelize.query(
    `
      SELECT
        (SELECT COUNT(*)
         FROM ediciones
         WHERE id_edicion = :idEdicion) AS ediciones,

        (SELECT COUNT(*)
         FROM edicion_categoria
         WHERE id_edicion = :idEdicion) AS categorias,

        (SELECT COUNT(*)
         FROM participacion
         WHERE id_edicion = :idEdicion) AS participaciones,

        (SELECT COUNT(*)
         FROM participacion p
         INNER JOIN usuarios u
           ON u.id_usuario = p.id_usuario
         WHERE p.id_edicion = :idEdicion) AS participantes,

        (SELECT COUNT(*)
         FROM edicion_categoria_rubrica ecr
         INNER JOIN edicion_categoria ec
           ON ec.id_edicion_categoria = ecr.id_edicion_categoria
         WHERE ec.id_edicion = :idEdicion) AS rubricas_categoria,

        (SELECT COUNT(*)
         FROM edicion_categoria_rubrica_criterio ecrc
         INNER JOIN edicion_categoria ec
           ON ec.id_edicion_categoria = ecrc.id_edicion_categoria
         WHERE ec.id_edicion = :idEdicion) AS criterios_categoria,

        (SELECT COUNT(*)
         FROM participacion_jurado pj
         INNER JOIN participacion p
           ON p.id_participacion = pj.id_participacion
         WHERE p.id_edicion = :idEdicion) AS jurados_asignados,

        (SELECT COUNT(*)
         FROM evaluacion_criterio ev
         INNER JOIN participacion_jurado pj
           ON pj.id_participacion_jurado =
              ev.id_participacion_jurado
         INNER JOIN participacion p
           ON p.id_participacion = pj.id_participacion
         WHERE p.id_edicion = :idEdicion) AS evaluaciones,

        (SELECT COUNT(*)
         FROM requisito_edicion
         WHERE id_edicion = :idEdicion) AS requisitos_edicion,

        (SELECT COUNT(*)
         FROM requisito_edicion_categoria rec
         INNER JOIN edicion_categoria ec
           ON ec.id_edicion_categoria = rec.id_edicion_categoria
         WHERE ec.id_edicion = :idEdicion) AS requisitos_categoria,

        (SELECT COUNT(*)
         FROM requisito_config cfg
         INNER JOIN requisito_edicion re
           ON re.id_requisito_edicion = cfg.id_requisito_edicion
         WHERE re.id_edicion = :idEdicion) AS configuracion_requisitos,

        (SELECT COUNT(*)
         FROM requisito_categoria_config cfg
         INNER JOIN requisito_edicion_categoria rec
           ON rec.id_requisito_edicion_categoria =
              cfg.id_requisito_edicion_categoria
         INNER JOIN edicion_categoria ec
           ON ec.id_edicion_categoria = rec.id_edicion_categoria
         WHERE ec.id_edicion = :idEdicion)
          AS configuracion_requisitos_categoria,

        (SELECT COUNT(*)
         FROM participacion_requisito pr
         INNER JOIN participacion p
           ON p.id_participacion = pr.id_participacion
         WHERE p.id_edicion = :idEdicion) AS respuestas_requisitos;
    `,
    {
      replacements: { idEdicion },
      type: QueryTypes.SELECT,
    },
  );

  // Relacionar cada total de la base de datos
  // con su correspondiente colección del snapshot.
  const comparaciones = [
    ["ediciones", 1, "ediciones"],
    ["categorias", snapshot.categorias.length, "categorias"],
    ["participaciones", snapshot.participaciones.length, "participaciones"],
    ["participantes", snapshot.participantes.length, "participantes"],
    [
      "rubricas_categoria",
      snapshot.rubricas_categoria.length,
      "rubricas_categoria",
    ],
    [
      "criterios_categoria",
      snapshot.criterios_categoria.length,
      "criterios_categoria",
    ],
    [
      "jurados_asignados",
      snapshot.jurados_asignados.length,
      "jurados_asignados",
    ],
    ["evaluaciones", snapshot.evaluaciones.length, "evaluaciones"],
    [
      "requisitos_edicion",
      snapshot.requisitos_edicion.length,
      "requisitos_edicion",
    ],
    [
      "requisitos_categoria",
      snapshot.requisitos_categoria.length,
      "requisitos_categoria",
    ],
    [
      "configuracion_requisitos",
      snapshot.configuracion_requisitos.length,
      "configuracion_requisitos",
    ],
    [
      "configuracion_requisitos_categoria",
      snapshot.configuracion_requisitos_categoria.length,
      "configuracion_requisitos_categoria",
    ],
    [
      "respuestas_requisitos",
      snapshot.respuestas_requisitos.length,
      "respuestas_requisitos",
    ],
  ];

  const diferencias = comparaciones
    .map(([nombre, cantidadSnapshot, campoBD]) => ({
      elemento: nombre,
      cantidad_bd: Number(totales[campoBD]),
      cantidad_snapshot: cantidadSnapshot,
    }))
    .filter((item) => item.cantidad_bd !== item.cantidad_snapshot);

  return {
    valido: diferencias.length === 0,
    id_edicion: idEdicion,
    diferencias,
    totales_bd: totales,
  };
};

const prepararSnapshotParaArchivo = (snapshot) => {
  if (!snapshot || !snapshot.edicion) {
    throw new Error("El snapshot no contiene una edición válida.");
  }

  // 1. Convertir el snapshot completo a JSON.
  const json = JSON.stringify(snapshot);

  if (!json) {
    throw new Error("No fue posible serializar el snapshot.");
  }

  // 2. Calcular el tamaño real del JSON en bytes UTF-8.
  const tamanoJsonBytes = Buffer.byteLength(json, "utf8");

  // 3. Calcular la huella digital SHA-256 del JSON.
  const checksum = crypto
    .createHash("sha256")
    .update(json, "utf8")
    .digest("hex");

  // 4. Preparar los totales que guardaremos con el histórico.
  const totales = {
    total_categorias: snapshot.categorias.length,
    total_postulaciones: snapshot.participaciones.length,
    total_participaciones: snapshot.participaciones.length,
    total_jurados: snapshot.jurados_asignados.length,
    total_evaluaciones: snapshot.evaluaciones.length,
    total_documentos: null,
  };

  return {
    id_edicion: snapshot.edicion.id_edicion,
    nombre_edicion: snapshot.edicion.nombre_edicion,
    fecha_inicio: snapshot.edicion.fecha_inicio,
    fecha_fin: snapshot.edicion.fecha_fin,
    datos: snapshot,
    json,
    checksum,
    tamano_json_bytes: tamanoJsonBytes,
    totales,
  };
};

const archivarEdicion = async (idEdicion, archivadoPor = null) => {
  // 1. Generar el snapshot de la edición elegible.
  const snapshot = await generarSnapshotEdicion(idEdicion);

  // 2. Validar las cantidades antes de guardar.
  const validacion = await validarSnapshotEdicion(snapshot);

  if (!validacion.valido) {
    throw new Error(
      `No se puede archivar la edición ${idEdicion}: ` +
        "la validación de cantidades presentó diferencias.",
    );
  }

  // 3. Preparar el JSON, su tamaño y su checksum.
  const preparado = prepararSnapshotParaArchivo(snapshot);

  // Contar respuestas que tienen una ruta de archivo registrada.
  // Esto cuenta metadatos de documentos, no archivos físicos verificados.
  const totalDocumentos = snapshot.respuestas_requisitos.filter(
    (respuesta) =>
      typeof respuesta.ruta_archivo === "string" &&
      respuesta.ruta_archivo.trim() !== "",
  ).length;

  // 4. Guardar y verificar dentro de una transacción.
  return sequelize.transaction(async (transaction) => {
    const existente = await HistoricoEdicion.findOne({
      where: { id_edicion: idEdicion },
      transaction,
    });

    if (existente) {
      throw new Error(
        `La edición ${idEdicion} ya tiene un registro histórico.`,
      );
    }

    await HistoricoEdicion.create(
      {
        id_edicion: preparado.id_edicion,
        nombre_edicion: preparado.nombre_edicion,
        fecha_inicio: preparado.fecha_inicio,
        fecha_fin: preparado.fecha_fin,

        total_categorias: preparado.totales.total_categorias,
        total_postulaciones: preparado.totales.total_postulaciones,
        total_participaciones: preparado.totales.total_participaciones,
        total_jurados: preparado.totales.total_jurados,
        total_evaluaciones: preparado.totales.total_evaluaciones,
        total_documentos: totalDocumentos,

        bytes_documentos_liberados: 0,

        datos: preparado.datos,
        checksum: preparado.checksum,
        version_esquema: 1,
        tamano_json_bytes: preparado.tamano_json_bytes,

        archivos_no_eliminados: [],
        archivado_por: archivadoPor,
      },
      { transaction },
    );

    // 5. Leer el registro guardado dentro de la misma transacción.
    const guardado = await HistoricoEdicion.findOne({
      where: { id_edicion: idEdicion },
      transaction,
    });

    if (!guardado) {
      throw new Error(
        "No fue posible recuperar el registro histórico guardado.",
      );
    }

    // Recalcular la huella del JSON recuperado.
    const jsonRecuperado = JSON.stringify(guardado.datos);

    const checksumRecuperado = crypto
      .createHash("sha256")
      .update(jsonRecuperado, "utf8")
      .digest("hex");

    if (checksumRecuperado !== guardado.checksum) {
      throw new Error(
        "El checksum del JSON recuperado no coincide. " +
          "Se cancelará la transacción.",
      );
    }

    // La transacción se confirma solo si todas las verificaciones pasan.
    return {
      correcto: true,
      id_historico: guardado.id_historico,
      id_edicion: guardado.id_edicion,
      nombre_edicion: guardado.nombre_edicion,
      tamano_json_bytes: Number(guardado.tamano_json_bytes),
      checksum: guardado.checksum,
      total_documentos: guardado.total_documentos,
      checksum_verificado: true,
    };
  });
};

module.exports = {
  listarEdicionesElegibles,
  generarSnapshotEdicion,
  validarSnapshotEdicion,
  prepararSnapshotParaArchivo,
  archivarEdicion,
};

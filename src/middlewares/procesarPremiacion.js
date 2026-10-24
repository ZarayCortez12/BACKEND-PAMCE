const cron = require("node-cron");
const { Op } = require("sequelize");
const {
  Edicion,
  Usuario,
  Rol,
  Categoria,
  EdicionCategoria,
  EdicionCategoriaRubrica,
  RubricaCriterio,
  EdicionCategoriaRubricaCriterio,
  ParticipacionJurado,
  Participacion,
  EvaluacionCriterio,
} = require("../models/index.js");
const dayjs = require("dayjs");
const { hoyBogota } = require("../utils/fechas");
const NotificacionService = require("./notificaciones.js");
const sequelize = require("../configs/db.js");

// Calcula la nota de las participaciones aceptadas de una categoría y asigna
// los puestos. Todo dentro de la transacción de esa categoría: si algo falla,
// solo se revierte esta categoría y las demás se procesan igual.
const procesarCategoria = async (edicionCategoria, transaction) => {
  const id_edicion_categoria = edicionCategoria.id_edicion_categoria;

  const participaciones = await Participacion.findAll({
    where: { id_edicion_categoria, estado: "aceptada" },
    transaction,
  });

  if (participaciones.length > 0) {
    const criteriosRequeridos = await EdicionCategoriaRubricaCriterio.findAll({
      where: { id_edicion_categoria },
      transaction,
    });

    if (criteriosRequeridos.length === 0) {
      throw new Error("La categoría no tiene criterios configurados.");
    }

    for (const participacion of participaciones) {
      const jurados = await ParticipacionJurado.findAll({
        where: { id_participacion: participacion.id_participacion },
        transaction,
      });

      for (const participacionJurado of jurados) {
        if (participacionJurado.estado !== "asignado") {
          continue;
        }

        const evaluaciones = await EvaluacionCriterio.findAll({
          where: {
            id_participacion_jurado: participacionJurado.id_participacion_jurado,
          },
          transaction,
        });

        const criteriosEvaluados = new Set(
          evaluaciones.map(
            (evaluacion) => evaluacion.id_edicion_categoria_rubrica_criterio,
          ),
        );

        const criteriosFaltantes = criteriosRequeridos.filter(
          (criterio) => !criteriosEvaluados.has(criterio.id_ecrc),
        );

        if (criteriosFaltantes.length === 0) {
          await ParticipacionJurado.update(
            {
              estado: "evaluado",
              fecha_evaluacion: participacionJurado.fecha_evaluacion || new Date(),
            },
            {
              where: {
                id_participacion_jurado:
                  participacionJurado.id_participacion_jurado,
              },
              transaction,
            },
          );
        } else {
          await ParticipacionJurado.update(
            {
              estado: "no_evaluado",
              observacion:
                "El jurado no completó la evaluación dentro del periodo establecido.",
            },
            {
              where: {
                id_participacion_jurado:
                  participacionJurado.id_participacion_jurado,
              },
              transaction,
            },
          );
        }
      }

      const juradosEvaluados = await ParticipacionJurado.findAll({
        where: {
          id_participacion: participacion.id_participacion,
          estado: "evaluado",
        },
        transaction,
      });

      if (juradosEvaluados.length === 0) {
        continue;
      }

      let notaFinal = 0;

      for (const criterio of criteriosRequeridos) {
        const evaluaciones = await EvaluacionCriterio.findAll({
          where: {
            id_edicion_categoria_rubrica_criterio: criterio.id_ecrc,
            id_participacion_jurado: {
              [Op.in]: juradosEvaluados.map(
                (jurado) => jurado.id_participacion_jurado,
              ),
            },
          },
          transaction,
        });

        if (evaluaciones.length === 0) {
          throw new Error(
            `No existen evaluaciones para el criterio ${criterio.id_ecrc} de la participación ${participacion.id_participacion}.`,
          );
        }

        const sumaCalificaciones = evaluaciones.reduce(
          (total, evaluacion) => total + Number(evaluacion.calificacion),
          0,
        );

        const promedioCriterio = sumaCalificaciones / evaluaciones.length;

        const pesoCriterio = Number(criterio.porcentaje);

        const rubricaCriterio = await RubricaCriterio.findByPk(
          criterio.id_rubrica_criterio,
          { transaction },
        );

        if (!rubricaCriterio) {
          throw new Error(
            `No se encontró el criterio ${criterio.id_rubrica_criterio}.`,
          );
        }

        const edicionCategoriaRubrica = await EdicionCategoriaRubrica.findOne({
          where: {
            id_edicion_categoria,
            id_rubrica: rubricaCriterio.id_rubrica,
          },
          transaction,
        });

        if (!edicionCategoriaRubrica) {
          throw new Error(
            `No se encontró la ponderación de la rúbrica para el criterio ${criterio.id_ecrc}.`,
          );
        }

        const pesoRubrica = Number(edicionCategoriaRubrica.porcentaje);

        const aporteCriterio =
          (pesoRubrica / 100) * (pesoCriterio / 100) * promedioCriterio;

        notaFinal += aporteCriterio;
      }

      await Participacion.update(
        {
          calificacion_final: Number(notaFinal.toFixed(2)),
          fecha_resultados: new Date(),
          estado: "evaluada",
        },
        {
          where: { id_participacion: participacion.id_participacion },
          transaction,
        },
      );
    }
  }

  const participacionesEvaluadas = await Participacion.findAll({
    where: { id_edicion_categoria, estado: "evaluada" },
    transaction,
  });

  if (participacionesEvaluadas.length === 0) {
    return;
  }

  const numeroGanadores = Number(edicionCategoria.numero_ganadores);

  if (!numeroGanadores || numeroGanadores <= 0) {
    throw new Error("La categoría no tiene un número válido de ganadores.");
  }

  participacionesEvaluadas.sort((a, b) => {
    const diferenciaNota =
      Number(b.calificacion_final) - Number(a.calificacion_final);

    if (diferenciaNota !== 0) {
      return diferenciaNota;
    }

    return (
      new Date(a.fecha_postulacion).getTime() -
      new Date(b.fecha_postulacion).getTime()
    );
  });

  for (let i = 0; i < participacionesEvaluadas.length; i++) {
    const participacion = participacionesEvaluadas[i];

    const esGanador = i < numeroGanadores;

    const puesto = esGanador ? i + 1 : null;

    await Participacion.update(
      { puesto, es_ganador: esGanador },
      {
        where: { id_participacion: participacion.id_participacion },
        transaction,
      },
    );
  }
};

// Avisa a los directores qué categorías no se pudieron premiar y por qué
const notificarErroresPremiacion = async (edicion, errores) => {
  const directores = await Usuario.findAll({
    include: [
      {
        model: Rol,
        as: "roles",
        required: true,
        where: { id_rol: 2 },
        through: { where: { estado_rol: "activo" } },
      },
    ],
  });

  const detalle = errores
    .map((e) => `<li><b>${e.categoria}</b>: ${e.mensaje}</li>`)
    .join("");

  for (const director of directores) {
    const notificacion = await NotificacionService.crear({
      tipo: "ERROR_PREMIACION",
      titulo: `No se pudo completar la premiación de ${edicion.nombre_edicion}`,
      mensaje: `
        <p>El procesamiento de la premiación no se completó en estas categorías:</p>
        <ul>${detalle}</ul>
        <p>Las demás categorías sí quedaron procesadas. Corrige la configuración
        indicada: el sistema lo intentará de nuevo esta noche.</p>
      `,
      id_usuario: director.id_usuario,
      id_rol: 2,
      prioridad: "alta",
      datos: { edicion_id: edicion.id_edicion, errores },
    });

    await NotificacionService.procesar(notificacion, ["sistema"], director);
  }
};

function procesarPremiacion() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const hoy = hoyBogota();

        console.log("Fecha actual:", hoy);

        const edicion = await Edicion.findOne({
          where: {
            estado_edicion: "en_proceso",
            fecha_procesamiento_premiacion: {
              [Op.is]: null,
            },
          },
        });

        if (!edicion) {
          return;
        }

        const inicioPremiacion = dayjs(edicion.fecha_inicio_premiacion).format(
          "YYYY-MM-DD",
        );

        if (hoy < inicioPremiacion) {
          return;
        }

        const categorias = await EdicionCategoria.findAll({
          where: { id_edicion: edicion.id_edicion },
          include: [{ model: Categoria, as: "categoria" }],
        });

        const errores = [];

        for (const edicionCategoria of categorias) {
          const transaction = await sequelize.transaction();

          try {
            await procesarCategoria(edicionCategoria, transaction);
            await transaction.commit();
          } catch (error) {
            await transaction.rollback();

            errores.push({
              categoria:
                edicionCategoria.categoria?.nombre_categoria ??
                `Categoría ${edicionCategoria.id_edicion_categoria}`,
              mensaje: error.message,
            });
          }
        }

        // Si alguna categoría falló, la edición no se marca como procesada
        // para que se reintente la próxima noche; las categorías que ya
        // quedaron bien no se recalculan (sus participaciones ya están
        // "evaluada" y solo se vuelven a ordenar).
        if (errores.length > 0) {
          console.error("ERROR EN CRON DE PREMIACIÓN", errores);
          await notificarErroresPremiacion(edicion, errores);
          return;
        }

        await Edicion.update(
          {
            fecha_procesamiento_premiacion: new Date(),
            fecha_actualizacion: new Date(),
          },
          {
            where: { id_edicion: edicion.id_edicion },
          },
        );
      } catch (error) {
        console.error("ERROR EN CRON DE PREMIACIÓN");
        console.error(error);
      }
    },
    {
      timezone: "America/Bogota",
    },
  );
}

module.exports = { procesarPremiacion };

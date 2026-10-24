const cron = require("node-cron");
const { Op } = require("sequelize");
const {
  Edicion,
  Usuario,
  Rol,
  Categoria,
  EdicionCategoria,
  EdicionCategoriaRubrica,
  Rubrica,
  RubricaCriterio,
  EdicionCategoriaRubricaCriterio,
  RequisitosEdicionCategoria,
  RequisitosEdicion,
  Requisitos,
  ParticipacionJurado,
  Participacion,
  EvaluacionCriterio,
} = require("../models/index.js");
const dayjs = require("dayjs");
const { hoyBogota } = require("../utils/fechas");
const NotificacionService = require("./notificaciones.js");
const path = require("path");
const localeEs = require("dayjs/locale/es");
dayjs.locale("es");
const sequelize = require("../configs/db.js");

function procesarPremiacion() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      const transaction = await sequelize.transaction();

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
          transaction,
        });

        if (!edicion) {
          await transaction.rollback();
          return;
        }

        const inicioPremiacion = dayjs(edicion.fecha_inicio_premiacion).format(
          "YYYY-MM-DD",
        );

        if (hoy < inicioPremiacion) {
          await transaction.rollback();
          return;
        }

        const participaciones = await Participacion.findAll({
          where: {
            id_edicion: edicion.id_edicion,
            estado: "aceptada",
          },
          transaction,
        });

        for (const participacion of participaciones) {
          const criteriosRequeridos =
            await EdicionCategoriaRubricaCriterio.findAll({
              where: {
                id_edicion_categoria: participacion.id_edicion_categoria,
              },
              transaction,
            });

          if (criteriosRequeridos.length === 0) {
            throw new Error(
              `La categoría ${participacion.id_edicion_categoria} no tiene criterios configurados.`,
            );
          }

          const jurados = await ParticipacionJurado.findAll({
            where: {
              id_participacion: participacion.id_participacion,
            },
            transaction,
          });

          for (const participacionJurado of jurados) {
            if (participacionJurado.estado !== "asignado") {
              continue;
            }

            const evaluaciones = await EvaluacionCriterio.findAll({
              where: {
                id_participacion_jurado:
                  participacionJurado.id_participacion_jurado,
              },
              transaction,
            });

            const criteriosEvaluados = new Set(
              evaluaciones.map(
                (evaluacion) =>
                  evaluacion.id_edicion_categoria_rubrica_criterio,
              ),
            );

            const criteriosFaltantes = criteriosRequeridos.filter(
              (criterio) => !criteriosEvaluados.has(criterio.id_ecrc),
            );

            if (criteriosFaltantes.length === 0) {
              await ParticipacionJurado.update(
                {
                  estado: "evaluado",
                  fecha_evaluacion:
                    participacionJurado.fecha_evaluacion || new Date(),
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
              {
                transaction,
              },
            );

            if (!rubricaCriterio) {
              throw new Error(
                `No se encontró el criterio ${criterio.id_rubrica_criterio}.`,
              );
            }

            const edicionCategoriaRubrica =
              await EdicionCategoriaRubrica.findOne({
                where: {
                  id_edicion_categoria: participacion.id_edicion_categoria,
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
              where: {
                id_participacion: participacion.id_participacion,
              },
              transaction,
            },
          );
        }

        const participacionesEvaluadas = await Participacion.findAll({
          where: {
            id_edicion: edicion.id_edicion,
            estado: "evaluada",
          },
          include: [
            {
              model: EdicionCategoria,
              as: "edicionCategoria",
              include: [
                {
                  model: Categoria,
                  as: "categoria",
                },
              ],
            },
          ],
          transaction,
        });

        const participacionesPorCategoria = {};

        for (const participacion of participacionesEvaluadas) {
          const idCategoria = participacion.id_edicion_categoria;

          if (!participacionesPorCategoria[idCategoria]) {
            participacionesPorCategoria[idCategoria] = [];
          }

          participacionesPorCategoria[idCategoria].push(participacion);
        }

        for (const idCategoria in participacionesPorCategoria) {
          const participacionesCategoria =
            participacionesPorCategoria[idCategoria];

          if (participacionesCategoria.length === 0) {
            continue;
          }

          const categoria =
            participacionesCategoria[0].edicionCategoria.categoria;

          const numeroGanadores = Number(
            participacionesCategoria[0].edicionCategoria.numero_ganadores,
          );

          if (!numeroGanadores || numeroGanadores <= 0) {
            throw new Error(
              `La categoría ${categoria.nombre_categoria} no tiene un número válido de ganadores.`,
            );
          }

          participacionesCategoria.sort((a, b) => {
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

          for (let i = 0; i < participacionesCategoria.length; i++) {
            const participacion = participacionesCategoria[i];

            const esGanador = i < numeroGanadores;

            const puesto = esGanador ? i + 1 : null;

            await Participacion.update(
              {
                puesto,
                es_ganador: esGanador,
              },
              {
                where: {
                  id_participacion: participacion.id_participacion,
                },
                transaction,
              },
            );
          }
        }

        await Edicion.update(
          {
            fecha_procesamiento_premiacion: new Date(),
            fecha_actualizacion: new Date(),
          },
          {
            where: {
              id_edicion: edicion.id_edicion,
            },
            transaction,
          },
        );

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();

        console.error("ERROR EN CRON DE CIERRE DE EDICIÓN");
        console.error(error);
      }
    },
    {
      timezone: "America/Bogota",
    },
  );
}

module.exports = { procesarPremiacion };

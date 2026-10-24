const cron = require("node-cron");
const { hoyBogota } = require("../utils/fechas");
const { etapaYaEjecutada } = require("../utils/etapasEjecutadas");
const { Op } = require("sequelize");
const {
  Edicion,
  Usuario,
  Rol,
  Categoria,
  EdicionCategoria,
  Participacion,
  ParticipacionJurado,
} = require("../models/index.js");
const dayjs = require("dayjs");
const NotificacionService = require("./notificaciones.js");
const path = require("path");
dayjs.locale("es");
const { sendEmailRechazarPostulacion } = require("../configs/mail.config");

function validacionInicioEtapaEvaluacion() {
  cron.schedule(
    "50 0 * * *",
    async () => {
      try {
        // Fecha de Colombia (el servidor puede estar en UTC). Se ejecuta
        // durante toda la etapa de evaluación y no solo el primer día: si el
        // servidor estuvo apagado ese día, se pone al día. Es seguro
        // repetirlo porque solo actúa sobre postulaciones que siguen
        // pendientes o aceptadas sin jurado.
        const hoy = hoyBogota();

        const edicion = await Edicion.findOne({
          where: {
            estado_edicion: "en_proceso",
            fecha_inicio_evaluacion: { [Op.lte]: hoy },
            fecha_fin_evaluacion: { [Op.gte]: hoy },
          },
        });

        console.log("Fecha actual:", hoy);
        console.log("Edicion:", edicion);

        if (!edicion) {
          return;
        }

        if (
          await etapaYaEjecutada({
            tipo: "INICIO_ETAPA_EVALUACION",
            edicion,
            campoFecha: "fecha_inicio_evaluacion",
          })
        ) {
          return;
        }

        const participacionesPendientes = await Participacion.findAll({
          where: {
            id_edicion: edicion.id_edicion,
            estado: "pendiente",
          },
          include: [
            {
              model: Usuario,
              as: "usuario",
              required: true,
            },
            {
              model: EdicionCategoria,
              as: "edicionCategoria",
              required: true,
              include: [
                {
                  model: Categoria,
                  as: "categoria",
                  required: true,
                },
              ],
            },
          ],
        });

        const participacionesAceptadas = await Participacion.findAll({
          where: {
            id_edicion: edicion.id_edicion,
            estado: "aceptada",
          },
          include: [
            {
              model: Usuario,
              as: "usuario",
              required: true,
            },
            {
              model: EdicionCategoria,
              as: "edicionCategoria",
              required: true,
              include: [
                {
                  model: Categoria,
                  as: "categoria",
                  required: true,
                },
              ],
            },
          ],
        });

        const participacionesSinJurados = [];

        for (const participacion of participacionesAceptadas) {
          const cantidadJurados = await ParticipacionJurado.count({
            where: {
              id_participacion: participacion.id_participacion,
              estado: {
                [Op.ne]: "retirado",
              },
            },
          });

          if (cantidadJurados === 0) {
            participacionesSinJurados.push(participacion);
          }
        }

        const participacionesRechazadasPorPendientes = [];

        for (const participacion of participacionesPendientes) {
          await Participacion.update(
            {
              estado: "rechazada",
              observacion:
                "Participación rechazada automáticamente porque no fue revisada por el administrador durante el periodo establecido de la convocatoria.",
              fecha_revision: new Date(),
            },
            {
              where: {
                id_participacion: participacion.id_participacion,
              },
            },
          );

          participacionesRechazadasPorPendientes.push(participacion);

          const notificacion = await NotificacionService.crear({
            tipo: "POSTULACION_RECHAZADA",
            titulo: "Postulación rechazada",
            mensaje: `
                  <p>Hola <b>${participacion.usuario.primer_nombre}</b>,</p>
        
                  <p>
                    Te informamos que tu postulación a la edición
                    <b>${edicion.nombre_edicion}</b> ha sido <b>rechazada</b>
                    porque no fue revisada antes del cierre de la etapa de convocatoria.
                  </p>

                  <p>
                    <b>Categoría:</b> ${participacion.edicionCategoria.categoria.nombre_categoria}
                  </p>

                  <p>
                    Agradecemos tu interés y te invitamos a participar
                    en próximas ediciones.
                  </p>
        
                  <p>
                    ¡Gracias por participar en el
                    <b>Premio Anual al Mérito Científico y Empresarial (PAMCE)</b>!
                  </p>
                `,
            prioridad: "media",
            id_usuario: participacion.usuario.id_usuario,
            id_rol: 4,
            datos: {
              id_edicion: edicion.id_edicion,
              nombre_edicion: edicion.nombre_edicion,
              id_edicion_categoria:
                participacion.edicionCategoria.id_edicion_categoria,
              nombre_categoria:
                participacion.edicionCategoria.categoria.nombre_categoria,
              estado_postulacion: "Rechazada",
            },
          });

          await NotificacionService.procesar(
            notificacion,
            ["sistema"],
            participacion.usuario,
          );

          sendEmailRechazarPostulacion(
            participacion.usuario.correo_electronico,
            participacion.usuario.primer_nombre,
            edicion.nombre_edicion,
            participacion.edicionCategoria.categoria.nombre_categoria,
          );
        }

        const participacionesRechazadasSinJurados = [];

        for (const participacion of participacionesSinJurados) {
          await Participacion.update(
            {
              estado: "rechazada",
              observacion:
                "Participación rechazada automáticamente porque, aunque fue aceptada durante la convocatoria, no contó con la asignación de jurados necesaria para iniciar la etapa de evaluación.",
              fecha_revision: new Date(),
            },
            {
              where: {
                id_participacion: participacion.id_participacion,
              },
            },
          );

          participacionesRechazadasSinJurados.push(participacion);
        }

        const participacionesRechazadas = [
          ...participacionesRechazadasPorPendientes,
          ...participacionesRechazadasSinJurados,
        ];

        const asignacionesRetiradas = [];

        for (const participacion of participacionesRechazadas) {
          const asignaciones = await ParticipacionJurado.findAll({
            where: {
              id_participacion: participacion.id_participacion,
              estado: {
                [Op.ne]: "retirado",
              },
            },
            include: [
              {
                model: Usuario,
                as: "jurado",
                required: true,
              },
            ],
          });

          for (const asignacion of asignaciones) {
            await ParticipacionJurado.update(
              {
                estado: "retirado",
                observacion:
                  "La asignación fue retirada automáticamente porque la participación fue rechazada al iniciar la etapa de evaluación.",
                fecha_actualizacion: new Date(),
              },
              {
                where: {
                  id_participacion_jurado: asignacion.id_participacion_jurado,
                },
              },
            );

            asignacionesRetiradas.push({
              asignacion,
              participacion,
            });
          }
        }

        const usuarios = await Usuario.findAll({
          include: [
            {
              model: Rol,
              as: "roles",
              required: true,
              where: {
                id_rol: 2,
              },
              through: {
                where: {
                  estado_rol: "activo",
                },
              },
            },
          ],
        });

        const totalPendientes = participacionesRechazadasPorPendientes.length;

        const totalSinJurados = participacionesRechazadasSinJurados.length;

        const totalRechazadas = participacionesRechazadas.length;

        const alertaParticipaciones =
          totalRechazadas > 0
            ? `
            <div style="
              font-family: system-ui, -apple-system, sans-serif;
              margin: 24px 0;
              padding: 20px;
              border: 1px solid #fecaca;
              background-color: #fef2f2;
              border-radius: 12px;
              color: #1f2937;
              line-height: 1.6;
            ">

              <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 12px;
              ">

                <strong style="
                  font-size: 16px;
                  color: #991b1b;
                ">
                  Participaciones que no continuarán a evaluación
                </strong>

              </div>

              <p style="
                margin: 0 0 18px 0;
                font-size: 14px;
                color: #4b5563;
              ">
                Al iniciar la etapa de evaluación se realizó una validación
                automática de las participaciones de la edición.
                Las siguientes situaciones fueron detectadas y gestionadas:
              </p>

              <div style="
                background-color: #ffffff;
                border: 1px solid #f3f4f6;
                border-radius: 8px;
                overflow: hidden;
              ">

                ${
                  totalPendientes > 0
                    ? `
                      <div style="
                        padding: 14px 16px;
                        border-bottom: 1px solid #f1f5f9;
                      ">

                        <strong style="
                          font-size: 14px;
                          color: #111827;
                        ">
                          Participaciones no revisadas
                        </strong>

                        <p style="
                          margin: 6px 0 0 16px;
                          font-size: 13px;
                          color: #6b7280;
                        ">
                          <strong>${totalPendientes}</strong>
                          participación${
                            totalPendientes === 1 ? "" : "es"
                          } permanecían en estado pendiente y fueron
                          rechazadas automáticamente debido a que no fueron
                          revisadas por el administrador durante la convocatoria.
                        </p>

                      </div>
                    `
                    : ""
                }

                ${
                  totalSinJurados > 0
                    ? `
                      <div style="
                        padding: 14px 16px;
                      ">

                        <strong style="
                          font-size: 14px;
                          color: #111827;
                        ">
                          Participaciones sin jurados asignados
                        </strong>

                        <p style="
                          margin: 6px 0 0 16px;
                          font-size: 13px;
                          color: #6b7280;
                        ">
                          <strong>${totalSinJurados}</strong>
                          participación${
                            totalSinJurados === 1 ? "" : "es"
                          } habían sido aceptadas, pero no contaban con
                          jurados asignados y fueron rechazadas automáticamente
                          porque no podían ingresar correctamente a la etapa
                          de evaluación.
                        </p>

                      </div>
                    `
                    : ""
                }

              </div>

              <div style="
                margin-top: 16px;
                padding: 11px 13px;
                background-color: #fff7ed;
                border-radius: 7px;
                border: 1px solid #fed7aa;
              ">

                <p style="
                  margin: 0;
                  font-size: 13px;
                  color: #9a3412;
                ">

                  <strong>Resultado:</strong>
                  ${totalRechazadas} participación${
                    totalRechazadas === 1 ? "" : "es"
                  } no continuarán en el proceso de evaluación de la
                  presente edición.

                </p>

              </div>

            </div>
          `
            : `
            <div style="
              margin: 24px 0;
              padding: 18px;
              background-color: #ecfdf5;
              border: 1px solid #bbf7d0;
              border-radius: 10px;
              color: #166534;
              font-family: system-ui, -apple-system, sans-serif;
            ">

              <strong>
                Todas las participaciones se encuentran listas para evaluación
              </strong>

              <p style="
                margin: 7px 0 0 0;
                font-size: 13px;
              ">
                No se encontraron participaciones pendientes ni participaciones
                aceptadas sin jurados asignados.
              </p>

            </div>
          `;

        for (const usuario of usuarios) {
          const notificacion = await NotificacionService.crear({
            tipo: "INICIO_ETAPA_EVALUACION",
            titulo: `La etapa de evaluación de la edición ${edicion.nombre_edicion} ha iniciado`,
            mensaje: `
            <p>Hola, administrador.</p>

            <p>
              Te informamos que la <b>etapa de evaluación</b> de la edición
              <b>${edicion.nombre_edicion}</b> ha iniciado.
            </p>

            <p>
              Antes de continuar con el proceso de evaluación, el sistema
              realizó automáticamente la validación de las participaciones
              para garantizar que únicamente continúen aquellas que se
              encuentran correctamente habilitadas para esta etapa.
            </p>

            ${alertaParticipaciones}

            <p>
              Las participaciones que fueron aceptadas y cuentan con jurados
              asignados permanecen habilitadas para continuar con el proceso
              de evaluación.
            </p>
          `,
            prioridad: "alta",
            id_usuario: usuario.id_usuario,
            id_rol: 2,
            datos: {
              edicion_id: edicion.id_edicion,
              fecha_inicio_evaluacion: edicion.fecha_inicio_evaluacion,
              participaciones_pendientes_rechazadas: totalPendientes,
              participaciones_sin_jurados_rechazadas: totalSinJurados,
              participaciones_rechazadas: totalRechazadas,
            },
          });

          const mensaje = {
            from: process.env.EMAIL_USER,
            to: [usuario.correo_electronico],
            subject: `La etapa de evaluación de ${edicion.nombre_edicion} ha iniciado`,
            html: `
            <!DOCTYPE html>
            <html lang="es">

            <head>
              <meta charset="UTF-8" />

              <style>
                body {
                  background: #e10318;
                  font-family: 'Segoe UI', Arial, sans-serif;
                  color: #333;
                  margin: 0;
                  padding: 0;
                }

                .container {
                  max-width: 650px;
                  margin: 40px auto;
                  background-color: #fff;
                  border-radius: 16px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                  overflow: hidden;
                }

                .content {
                  padding: 30px 40px;
                  text-align: center;
                }

                .footer {
                  background-color: #f7f7f7;
                  padding: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #999;
                }
              </style>
            </head>

            <body style="
              margin:0;
              padding:10px;
              background-color:#f2f3f7;
              font-family:'Segoe UI',Arial,sans-serif;
              color:#333;
            ">

              <div class="container">

                <div style="
                  display:flex;
                  align-items:center;
                  border-bottom:1px solid #eee;
                  padding-bottom:10px;
                ">

                  <h2 style="
                    margin-top:30px;
                    color:#e10318;
                    margin-left:15px;
                  ">
                    Inicio de la Etapa de Evaluación
                  </h2>

                  <img
                    src="cid:logoPamce"
                    alt="PAMCE"
                    style="
                      max-height:50px;
                      margin-left:220px;
                      margin-top:20px
                    "
                  />

                </div>

                <div class="content">

                  <p>
                    <strong>Hola ${usuario.primer_nombre},</strong>
                  </p>

                  <p>
                    Te informamos que la
                    <strong>etapa de evaluación</strong>
                    de la edición
                    <strong>${edicion.nombre_edicion}</strong>
                    ha iniciado correctamente.
                  </p>

                  <p style="font-size:16px;">
                    <strong>Fecha de inicio:</strong>
                    ${dayjs(edicion.fecha_inicio_evaluacion).format(
                      "DD [de] MMMM [de] YYYY",
                    )}
                  </p>

                  <p>
                    Como parte del inicio de esta etapa, el sistema realizó
                    una validación automática de las participaciones para
                    garantizar que el proceso de evaluación comience con
                    información consistente.
                  </p>

                  ${alertaParticipaciones}

                  <div style="
                    margin-top:30px;
                    padding:18px;
                    background:#f8fafc;
                    border:1px solid #cbd5e1;
                    border-radius:8px;
                    text-align:left;
                    color:#475569;
                  ">

                    <strong style="color:#1e293b;">
                      Estado del proceso
                    </strong>

                    <p style="margin-bottom:0;">
                      Las participaciones que fueron aceptadas y cuentan
                      con jurados asignados continuarán normalmente en la
                      etapa de evaluación.
                    </p>

                  </div>

                  <p style="
                    margin-top:30px;
                    font-size:13px;
                    color:#666;
                  ">
                    Este es un mensaje automático, por favor no responder.
                  </p>

                </div>

                <div class="footer">
                  <p>No responder a este correo.</p>
                  <p>
                    &copy; 2026 PAMCE. Todos los derechos reservados.
                  </p>
                </div>

              </div>

            </body>
            </html>
          `,
            attachments: [
              {
                filename: "logo_pamce.png",
                path: path.join(__dirname, "../images/logo_pamce.png"),
                cid: "logoPamce",
              },
            ],
          };

          await NotificacionService.procesar(
            notificacion,
            ["sistema", "email"],
            usuario,
            mensaje,
          );
        }
      } catch (error) {
        console.error("ERROR EN CRON");
        console.error(error);
      }
    },
    {
      timezone: "America/Bogota",
    },
  );
}

module.exports = { validacionInicioEtapaEvaluacion };

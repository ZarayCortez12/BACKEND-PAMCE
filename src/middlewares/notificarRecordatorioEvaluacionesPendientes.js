const cron = require("node-cron");
const { Op } = require("sequelize");
const {
  Edicion,
  Usuario,
  Rol,
  Categoria,
  EdicionCategoria,
  ParticipacionJurado,
  Participacion,
} = require("../models/index.js");
const dayjs = require("dayjs");
const NotificacionService = require("./notificaciones.js");
const path = require("path");
dayjs.locale("es");

function notificarRecordatorioEvaluacionesPendientes() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const edicion = await Edicion.findOne({
          where: {
            estado_edicion: "en_proceso",
          },
        });

        if (!edicion) {
          return;
        }

        const diasRestantes = dayjs(edicion.fecha_fin_evaluacion)
          .startOf("day")
          .diff(dayjs().startOf("day"), "day");

        if (![15, 7, 5, 3].includes(diasRestantes)) {
          return;
        }

        const evaluaciones_pendientes = await ParticipacionJurado.findAll({
          where: {
            estado: "asignado",
          },
          include: [
            {
              model: Participacion,
              as: "participacion",
              required: true,
              include: [
                {
                  model: EdicionCategoria,
                  as: "edicionCategoria",
                  required: true,
                  include: [
                    {
                      model: Edicion,
                      as: "edicion",
                      required: true,
                      where: {
                        id_edicion: edicion.id_edicion,
                      },
                    },
                    {
                      model: Categoria,
                      as: "categoria",
                    },
                  ],
                },
                {
                  model: Usuario,
                  as: "usuario",
                },
              ],
            },
            {
              model: Usuario,
              as: "jurado",
              required: true,
            },
          ],
        });

        const pendientes_por_jurado = {};

        for (const evaluacion of evaluaciones_pendientes) {
          const id_jurado = evaluacion.jurado.id_usuario;

          if (!pendientes_por_jurado[id_jurado]) {
            pendientes_por_jurado[id_jurado] = {
              jurado: evaluacion.jurado,
              pendientes: [],
            };
          }

          pendientes_por_jurado[id_jurado].pendientes.push(evaluacion);
        }

        for (const { jurado, pendientes } of Object.values(
          pendientes_por_jurado,
        )) {
          const notificacion = await NotificacionService.crear({
            tipo: "RECORDATORIO_EVALUACION",
            titulo: `Tienes evaluaciones pendientes`,
            mensaje: `
            <p>Hola <b>${jurado.nombres}</b>,</p>

            <p>
              La etapa de evaluación de la edición
              <b>${edicion.nombre_edicion}</b> finaliza en
              <b>${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}</b>.
            </p>

            <p>
              Actualmente tienes <b>${pendientes.length}</b>
              ${pendientes.length === 1 ? "evaluación pendiente" : "evaluaciones pendientes"}.
            </p>

            <p>Te invitamos a completarlas antes del cierre de la etapa de evaluación.</p>
          `,
            id_usuario: jurado.id_usuario,
            prioridad: "alta",
            id_rol: 3,
            datos: {
              edicion_id: edicion.id_edicion,
              fecha_fin_evaluacion: edicion.fecha_fin_evaluacion,
              dias_restantes: diasRestantes,
            },
          });

          const mensaje = {
            from: process.env.EMAIL_USER,
            to: [jurado.correo_electronico],
            subject: `Recordatorio: tienes evaluaciones pendientes en ${edicion.nombre_edicion}`,
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
              .header {
                background: linear-gradient(135deg, #e10318, #f54257);
                color: white;
                text-align: center;
                padding: 30px 20px;
              }
              .header img {
                max-height: 60px;
                margin-bottom: 10px;
              }
              .content {
                padding: 30px 40px;
                text-align: center;
              }
              .content h2 {
                color: #e10318;
                font-size: 22px;
                margin-bottom: 15px;
              }
              .content p {
                font-size: 15px;
                line-height: 1.6;
                color: #555;
              }
              .vector {
                width: 100%;
                max-width: 250px;
                margin: 20px auto;
                display: block;
              }
              .btn {
                display: inline-block;
                margin-top: 25px;
                padding: 14px 28px;
                background: linear-gradient(135deg, #e10318, #f54257);
                color: white !important;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
                letter-spacing: 0.5px;
                transition: opacity 0.3s;
              }
              .btn:hover {
                opacity: 0.9;
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
          <body style="margin:0;padding:10px;background-color:#f2f3f7;font-family:'Segoe UI',Arial,sans-serif;color:#333;">
            <div class="container">
              <div style="display:flex;align-items:center;border-bottom:1px solid #eee;padding-bottom:10px;"> 
              <h2 style="margin-top:30px; color:#e10318;margin-left:15px">Inicio de la Etapa de Convocatoria</h2> 
              <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:220px; margin-top:20px" /> 
              </div>
          
              <div class="content">
                <p>Hola <strong>${jurado.primer_nombre}</strong>,</p>
          
                <p>
                  Te recordamos que haces parte del comité evaluador de la edición
                  <strong>${edicion.nombre_edicion}</strong> del Programa PAMCE.
                </p>

                <p>
                Al día de hoy, aún tienes
                <strong>${pendientes.length}
                ${pendientes.length === 1 ? "evaluación pendiente" : "evaluaciones pendientes"}</strong>
                por completar.
                </p>

                <div
                  style="
                    background:#fff5f5;
                    border-left:5px solid #e10318;
                    padding:16px;
                    margin:25px 0;
                    border-radius:6px;
                  "
                >
                  <p style="margin:0;">
                    <strong>⏳ Tiempo restante</strong><br><br>

                    La etapa de evaluación finalizará en
                    <strong>${diasRestantes}
                    ${diasRestantes === 1 ? "día" : "días"}</strong>,
                    el
                    <strong>${dayjs(edicion.fecha_fin_evaluacion).format("DD [de] MMMM [de] YYYY")}</strong>.
                  </p>
                </div>

                <p>
                Te invitamos a ingresar al sistema y completar las evaluaciones asignadas
                antes de la fecha límite, garantizando así el correcto desarrollo del proceso
                de evaluación y la igualdad de condiciones para todos los participantes.
                </p>

                <p>
                Tu compromiso como jurado es fundamental para asegurar la transparencia,
                objetividad y calidad del proceso de selección.
                </p>


                <p style="margin-top:30px;font-size:13px;color:#666;">
                  Este es un mensaje automático, por favor no responder.
                </p>
              </div>
          
              <div class="footer">
                <p>No responder a este correo.</p>
                <p>&copy; 2026 PAMCE. Todos los derechos reservados.</p>
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
            jurado,
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

module.exports = { notificarRecordatorioEvaluacionesPendientes };

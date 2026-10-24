const cron = require("node-cron");
const { Op } = require("sequelize");
const {
  Edicion,
  Usuario,
  Rol,
  Participacion,
  ParticipacionJurado,
} = require("../models");
const dayjs = require("dayjs");
const NotificacionService = require("./notificaciones.js");
const path = require("path");
dayjs.locale("es");

function notificarEtapaEvaluacion() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const edicion = await Edicion.findOne({
          where: {
            estado_edicion: "en_proceso",
          },
        });

        console.log("notificarEtapaEvaluacion Ingres");

        if (!edicion) {
          return;
        }

        const diasRestantes = dayjs(edicion.fecha_inicio_evaluacion)
          .startOf("day")
          .diff(dayjs().startOf("day"), "day");

        if (![15, 7, 5, 3].includes(diasRestantes)) {
          return;
        }

        const participacionesPendientes = await Participacion.count({
          where: {
            id_edicion: edicion.id_edicion,
            estado: "pendiente",
          },
        });

        const participacionesAceptadas = await Participacion.findAll({
          where: {
            id_edicion: edicion.id_edicion,
            estado: "aceptada",
          },
          attributes: ["id_participacion"],
        });

        const idsParticipacionesAceptadas = participacionesAceptadas.map(
          (participacion) => participacion.id_participacion,
        );

        let participacionesSinJurados = 0;

        if (idsParticipacionesAceptadas.length > 0) {
          const asignacionesJurados = await ParticipacionJurado.findAll({
            where: {
              id_participacion: {
                [Op.in]: idsParticipacionesAceptadas,
              },
            },
            attributes: ["id_participacion"],
          });

          const participacionesConJurados = new Set(
            asignacionesJurados.map(
              (asignacion) => asignacion.id_participacion,
            ),
          );

          participacionesSinJurados = idsParticipacionesAceptadas.filter(
            (idParticipacion) =>
              !participacionesConJurados.has(idParticipacion),
          ).length;
        }

        const problemasEvaluacion = [];

        if (participacionesPendientes > 0) {
          problemasEvaluacion.push({
            tipo: "pendientes",
            cantidad: participacionesPendientes,
          });
        }

        if (participacionesSinJurados > 0) {
          problemasEvaluacion.push({
            tipo: "sin_jurados",
            cantidad: participacionesSinJurados,
          });
        }

        const usuarios = await Usuario.findAll({
          include: [
            {
              model: Rol,
              as: "roles",
              required: true,
              where: { id_rol: 2 },
              through: {
                where: {
                  estado_rol: "activo",
                },
              },
            },
          ],
        });

        if (diasRestantes !== 3 && problemasEvaluacion.length === 0) {
          return;
        }

        const alertaEvaluacion =
          problemasEvaluacion.length > 0 &&
          `
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
          margin-bottom: 8px;
        ">

          <strong style="
            font-size: 16px;
            color: #991b1b;
          ">
            Aspectos pendientes antes de iniciar la evaluación
          </strong>

        </div>

        <p style="
          margin: 0 0 18px 42px;
          font-size: 14px;
          color: #4b5563;
        ">
          Se encontraron situaciones que requieren atención antes del inicio
          de la etapa de evaluación:
        </p>

        <div style="
          background-color: #ffffff;
          border: 1px solid #f3f4f6;
          border-radius: 8px;
          overflow: hidden;
        ">

          ${problemasEvaluacion
            .map((problema, index) => {
              let titulo = "";
              let descripcion = "";

              if (problema.tipo === "pendientes") {
                titulo = "Participaciones pendientes";
                descripcion = `Hay <strong>${problema.cantidad}</strong> participación${
                  problema.cantidad === 1 ? "" : "es"
                } que aún se encuentran pendientes de revisión.`;
              }

              if (problema.tipo === "sin_jurados") {
                titulo = "Participaciones sin jurados asignados";
                descripcion = `Hay <strong>${problema.cantidad}</strong> participación${
                  problema.cantidad === 1 ? "" : "es"
                } aceptada${
                  problema.cantidad === 1 ? "" : "s"
                } que aún no cuentan con jurados asignados.`;
              }

              return `
                    <div style="
                      padding: 14px 16px;
                      ${
                        index < problemasEvaluacion.length - 1
                          ? "border-bottom: 1px solid #f1f5f9;"
                          : ""
                      }
                    ">
                    
                      <div style="
                        display: flex;
                        align-items: center;
                        gap: 9px;
                        margin-bottom: 5px;
                      ">
                    
                        <strong style="
                          font-size: 14px;
                          color: #111827;
                        ">
                          ${titulo}
                        </strong>
                    
                      </div>
                    
                      <p style="
                        margin: 0 0 0 16px;
                        font-size: 13px;
                        color: #6b7280;
                      ">
                        ${descripcion}
                      </p>
                    
                    </div>
                  `;
            })
            .join("")}
              
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
                <strong>Recomendación:</strong>
                revisa y gestiona estas situaciones antes de la fecha de inicio
                de la etapa de evaluación para garantizar que las participaciones
                estén listas para ser evaluadas.
              </p>
              
            </div>
              
          </div>
        `;

        for (const usuario of usuarios) {
          const notificacion = await NotificacionService.crear({
            tipo: "ETAPA_EVALUACION_PROXIMA",
            titulo: `La etapa de evaluación de la edición ${edicion.nombre_edicion} inicia en ${diasRestantes} días`,
            mensaje: `
          <p>Hola, administrador.</p>
          <p>
            Te informamos que la <b>etapa de evaluación</b> de la edición
            <b>${edicion.nombre_edicion}</b> iniciará en <b>${diasRestantes} días</b>.
          </p>
          <p><b>Fecha de inicio de la etapa de evaluación:</b> ${edicion.fecha_inicio_evaluacion}</p>
          <p>
            Verifica que las participaciones hayan sido gestionadas y que aquellas
            que hayan sido aceptadas cuenten con los jurados correspondientes
            antes del inicio de la etapa de evaluación.
          </p>

          ${alertaEvaluacion}
        `,
            prioridad: "alta",
            id_usuario: usuario.id_usuario,
            id_rol: 2,
            datos: {
              edicion_id: edicion.id_edicion,
              fecha_inicio_evaluacion: edicion.fecha_inicio_evaluacion,
              dias_restantes: diasRestantes,
            },
          });

          const mensaje = {
            from: process.env.EMAIL_USER,
            to: [usuario.correo_electronico],
            subject: `La etapa de evaluación de ${edicion.nombre_edicion} inicia en ${diasRestantes} días`,
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
              <h2 style="margin-top:30px; color:#e10318;margin-left:15px">Inicio de la Etapa de Evaluación</h2> 
              <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:220px; margin-top:20px" /> 
              </div>
          
              <div class="content">
                <p><strong>Hola ${usuario.primer_nombre},</strong></p>
          
                <p>
                  Se acerca la fecha de inicio de la etapa de evaluación de la edición: <strong>${edicion.nombre_edicion}</strong>
                </p>

                <p style="font-size:16px;">
                  Fecha de Inicio de la Etapa de Evaluación: <strong>${dayjs(
                    edicion.fecha_inicio_evaluacion,
                  ).format("DD [de] MMMM [de] YYYY")}</strong>
                </p>
          
                <p style="color:red;">
                  Faltan aproximadamente <strong>${diasRestantes}</strong> días.
                </p>
          
                <p>
                  Antes del inicio de la etapa de evaluación, verifica que todas las
                  participaciones hayan sido gestionadas y que las participaciones aceptadas
                  cuenten con los jurados asignados correspondientes.
                </p>
          
                <div style="padding:1px;">
                  ${alertaEvaluacion}
                </div>

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
            usuario,
            mensaje,
          );
        }
      } catch (error) {
        console.error("ERROR EN CRON notificarEtapaEvaluacion");
        console.error(error);
      }
    },
    {
      timezone: "America/Bogota",
    },
  );
}

module.exports = { notificarEtapaEvaluacion };

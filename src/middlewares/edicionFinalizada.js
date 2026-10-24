const cron = require("node-cron");
const { Op } = require("sequelize");
const {
  Edicion,
  Usuario,
  Rol,
  ParticipacionJurado,
  Participacion,
} = require("../models");
const NotificacionService = require("./notificaciones.js");
const dayjs = require("dayjs");
const { hoyBogota } = require("../utils/fechas");
const path = require("path");

function edicionFinalizada() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      const hoy = hoyBogota();

      try {
        const participantes = [];
        const jurados = [];

        const edicion = await Edicion.findOne({
          where: {
            fecha_fin: {
              [Op.lt]: hoy,
            },
            estado_edicion: "en_proceso",
          },
        });

        if (!edicion) {
          return;
        }

        const enviarNotificacionFinalizacion = async ({
          usuario,
          idRol,
          saludo,
          agradecimiento,
        }) => {
          const notificacion = await NotificacionService.crear({
            tipo: "EDICION_FINALIZADA",
            titulo: `La edición ${edicion.nombre_edicion} ha finalizado`,
            mensaje: `
           <p>🎉 Hola ${saludo},</p>

            <p>
              Te informamos que la edición
              <b>${edicion.nombre_edicion}</b>
              ha finalizado oficialmente y su estado ha sido actualizado a
              <b>Finalizada</b>.
            </p>

            <p>
              Con esto se da por concluido el ciclo de actividades correspondiente
              a esta edición en la plataforma PAMCE.
            </p>

            <p>
              <b>Fecha de inicio:</b>
              ${dayjs(edicion.fecha_inicio).format("DD/MM/YYYY")}
            </p>

            <p>
              <b>Fecha de finalización:</b>
              ${dayjs(edicion.fecha_fin).format("DD/MM/YYYY")}
            </p>

            <p>
              ${agradecimiento}
            </p>

            <p>
              ¡Gracias por contribuir al desarrollo de esta edición en PAMCE!
            </p>
          `,
            prioridad: "alta",
            id_usuario: usuario.id_usuario,
            id_rol: idRol,
            datos: {
              edicion_id: edicion.id_edicion,
              fecha_fin: edicion.fecha_fin,
            },
          });

          const mensaje = {
            from: process.env.EMAIL_USER,
            to: [usuario.correo_electronico],
            subject: `La edición ${edicion.nombre_edicion} ha finalizado`,
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
                  .edition-name { color: #e10318; font-weight: bold; }
                  .highlight { background: #fff5f5; border-left: 4px solid #e10318; padding: 18px; border-radius: 8px; margin: 25px 0; } .highlight p { margin: 8px 0; color: #444; }
                </style>
              </head>
              <body style="margin:0;padding:5px 5px;background-color:#f2f3f7;font-family:'Segoe UI',Arial,sans-serif;color:#333;">
                <div class="container">
                  <div style="display:flex;align-items:center;border-bottom:1px solid #eee;padding-bottom:10px;"> 
                  <h2 style="margin-top:30px; color:#e10318;margin-left:20px">Finalización de Edición</h2> 
                  <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:300px; margin-top:20px" /> 
                  </div>
              
                   <div class="content">
                    <p>
                      <strong>Hola ${usuario.primer_nombre},</strong>
                    </p>

                    <p>
                      Te informamos que la edición
                      <span class="edition-name">
                        ${edicion.nombre_edicion}
                      </span>
                      ha finalizado oficialmente.
                    </p>

                    <p>
                      Con esto se da por concluido el ciclo de actividades
                      correspondiente a esta edición en la plataforma PAMCE.
                    </p>

                    <div class="highlight">

                      <p>
                        <strong>Fecha de inicio:</strong>
                        ${dayjs(edicion.fecha_inicio).format("DD [de] MMMM [de] YYYY")}
                      </p>

                      <p>
                        <strong>Fecha de finalización:</strong>
                        ${dayjs(edicion.fecha_fin).format("DD [de] MMMM [de] YYYY")}
                      </p>

                    </div>

                    <p>
                      ${agradecimiento}
                    </p>

                    <p>
                      ¡Gracias por contribuir al desarrollo de esta edición en PAMCE!
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
            usuario,
            mensaje,
          );
        };

        await edicion.update({
          estado_edicion: "finalizada",
        });

        const directores = await Usuario.findAll({
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

        const participaciones = await Participacion.findAll({
          where: {
            id_edicion: edicion.id_edicion,
            estado: { [Op.in]: ["aceptada", "evaluada"] },
          },
          include: [
            {
              model: ParticipacionJurado,
              as: "juradosAsignados",
              required: false,
              include: [
                {
                  model: Usuario,
                  as: "jurado",
                },
              ],
            },
            {
              model: Usuario,
              as: "usuario",
              required: true,
            },
          ],
          distinct: true,
          subQuery: false,
        });

        for (const participacion of participaciones) {
          if (participacion.usuario) {
            const yaExiste = participantes.some(
              (usuario) =>
                usuario.id_usuario === participacion.usuario.id_usuario,
            );

            if (!yaExiste) {
              participantes.push(participacion.usuario);
            }
          }

          for (const asignacion of participacion.juradosAsignados ?? []) {
            if (asignacion.jurado) {
              const yaExiste = jurados.some(
                (jurado) => jurado.id_usuario === asignacion.jurado.id_usuario,
              );

              if (!yaExiste) {
                jurados.push(asignacion.jurado);
              }
            }
          }
        }

        for (const usuario of directores) {
          await enviarNotificacionFinalizacion({
            usuario,
            idRol: 2,
            saludo: "Director",
            agradecimiento: `
            Agradecemos tu gestión y acompañamiento durante el desarrollo
            de esta edición. Te recomendamos consultar la información y los
            resultados registrados en la plataforma para realizar el seguimiento
            correspondiente.
          `,
          });
        }

        for (const usuario of jurados) {
          await enviarNotificacionFinalizacion({
            usuario,
            idRol: 3,
            saludo: "Jurado",
            agradecimiento: `
            Agradecemos tu participación, compromiso y dedicación durante
            el proceso de evaluación de esta edición. Tu labor como jurado
            fue fundamental para el desarrollo del proceso.
          `,
          });
        }

        for (const usuario of participantes) {
          await enviarNotificacionFinalizacion({
            usuario,
            idRol: 4,
            saludo: "Participante",
            agradecimiento: `
            Agradecemos tu participación y el tiempo dedicado durante el
            desarrollo de esta edición. Valoramos tu interés en formar parte
            de este proceso y esperamos contar contigo en futuras ediciones
            de PAMCE.
          `,
          });
        }
      } catch (error) {
        console.log("Error actualizando estados de ediciones:", error);
      }
    },
    {
      timezone: "America/Bogota",
    },
  );
}

module.exports = { edicionFinalizada };

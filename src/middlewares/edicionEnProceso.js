const cron = require("node-cron");
const { Op } = require("sequelize");
const { Edicion, Usuario, Rol } = require("../models");
const dayjs = require("dayjs");
const { hoyBogota } = require("../utils/fechas");
const NotificacionService = require("./notificaciones.js");
const path = require("path");
const localeEs = require("dayjs/locale/es");
dayjs.locale("es");

function edicionEnProceso() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      const hoy = hoyBogota();

      try {
        // Solo puede haber una edición en proceso
        const enProceso = await Edicion.findOne({
          where: { estado_edicion: "en_proceso" },
        });

        if (enProceso) {
          return;
        }

        // <= en lugar de ==: si el servidor estuvo apagado el día de inicio,
        // la edición pasa a en_proceso en la siguiente ejecución. Solo toma
        // ediciones "activo", así que no se repite una vez iniciada.
        const edicion = await Edicion.findOne({
          where: {
            fecha_inicio: { [Op.lte]: hoy },
            fecha_fin: { [Op.gte]: hoy },
            estado_edicion: "activo",
          },
          order: [["fecha_inicio", "ASC"]],
        });

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

        if (edicion) {
          await edicion.update({
            estado_edicion: "en_proceso",
          });

          for (const usuario of usuarios) {
            const notificacion = await NotificacionService.crear({
              tipo: "INICIO_EDICION",
              titulo: `La edición ${edicion.nombre_edicion} ha iniciado`,
              mensaje: `
              <p>🎉 Hola Director,</p> 
              <p>
                Nos complace informarle que la edición
                <b>${edicion.nombre_edicion}</b>
                ha iniciado oficialmente y ahora se encuentra en estado <b>En Proceso</b>.
              </p>
              <p>
                <b>Fecha de inicio de la edición:</b>
                ${dayjs(edicion.fecha_inicio).format("DD/MM/YYYY")}
              </p>
              <p>
                <b>Fecha de finalización de la edición:</b>
                ${dayjs(edicion.fecha_fin).format("DD/MM/YYYY")}
              </p>
              <p>
                A partir de este momento, es importante avanzar en la planificación y
                configuración de las actividades necesarias para el desarrollo de la edición,
                así como preparar todo lo requerido para el inicio de la convocatoria.
              </p>
              <p>
                <b>Fecha de inicio de la convocatoria:</b>
                ${dayjs(edicion.fecha_inicio_convocatoria).format("DD/MM/YYYY")}
              </p>
              <p>
                Le recomendamos verificar que la información, categorías, cronogramas y
                demás elementos asociados se encuentren correctamente configurados para
                garantizar un proceso exitoso.
              </p>
            `,
              prioridad: "alta",
              id_usuario: usuario.id_usuario,
              id_rol: 2,
              datos: {
                edicion_id: edicion.id_edicion,
                fecha_inicio: edicion.fecha_inicio,
              },
            });

            const mensaje = {
              from: process.env.EMAIL_USER,
              to: [usuario.correo_electronico],
              subject: `La edición ${edicion.nombre_edicion} ha iniciado`,
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
                      <h2 style="margin-top:30px; color:#e10318;margin-left:20px">Inicio de Edición</h2> 
                      <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:300px; margin-top:20px" /> 
                      </div>
                  
                      <div class="content">
                        <p><strong>Hola ${usuario.primer_nombre},</strong></p>
                  
                        <p> Nos complace informarte que la edición <span class="edition-name">${edicion.nombre_edicion}</span> ha iniciado oficialmente y se encuentra actualmente en estado <strong>En Proceso</strong>. </p> 
                        <p> Este marca el comienzo de una nueva etapa de organización, preparación y desarrollo de actividades dentro de la plataforma PAMCE. </p> 
                        <div class="highlight"> 
                        <p> <strong>Inicio de la edición:</strong> ${dayjs(edicion.fecha_inicio).format("DD [de] MMMM [de] YYYY")} </p> 
                        <p> <strong>Finalización de la edición:</strong> ${dayjs(edicion.fecha_fin).format("DD [de] MMMM [de] YYYY")} </p> 
                        <p> <strong>Inicio de la convocatoria:</strong> ${dayjs(edicion.fecha_inicio_convocatoria).format("DD [de] MMMM [de] YYYY")} </p> </div> <p> Te recomendamos revisar la configuración de la edición y realizar los ajustes necesarios para garantizar que todo se encuentre preparado para la apertura de la convocatoria y el correcto desarrollo de las actividades. </p> 
                        
                        <p> Agradecemos tu compromiso y participación en este proceso. ¡Te deseamos una excelente gestión durante esta nueva edición! </p>
                  
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
        }
      } catch (error) {
        console.error("Error actualizando estados de ediciones:", error);
      }
    },
    {
      timezone: "America/Bogota",
    },
  );
}

module.exports = { edicionEnProceso };

const cron = require("node-cron");
const { Op } = require("sequelize");
const { Edicion, Usuario, Rol } = require("../models");
const dayjs = require("dayjs");
const NotificacionService = require("./notificaciones.js");
const path = require("path");
const localeEs = require("dayjs/locale/es");
dayjs.locale("es");

function notificarEdicion() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const targetDate = dayjs().add(3, "day").format("YYYY-MM-DD");

        const edicion = await Edicion.findOne({
          where: {
            fecha_inicio: targetDate,
          },
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

        if (!edicion) {
          return;
        }

        for (const usuario of usuarios) {
          const notificacion = await NotificacionService.crear({
            tipo: "EDICION_PROXIMA",
            titulo: `Inicio de edición próximo: ${edicion.nombre_edicion}`,
            mensaje: `
          <p>Hola Director</p>
          <p>La edición <b>${edicion.nombre_edicion}</b> inicia en 3 días.</p>
          <p>Fecha de inicio: ${edicion.fecha_inicio}</p>
        `,
            prioridad: "alta",
            id_usuario: usuario.id_usuario,
            id_rol: 2,
            datos: {
              edicion_id: edicion.id_edicion,
              fecha_inicio: edicion.fecha_inicio,
              dias_restantes: 3,
            },
          });

          const mensaje = {
            from: process.env.EMAIL_USER,
            to: [usuario.correo_electronico],
            subject: `Inicio próximo de edición: ${edicion.nombre_edicion}`,
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
          <body style="margin:0;padding:0;background-color:#f2f3f7;font-family:'Segoe UI',Arial,sans-serif;color:#333;">
            <div class="container">
              <div style="display:flex;align-items:center;border-bottom:1px solid #eee;padding-bottom:10px;"> 
              <h2 style="margin-top:30px; color:#e10318;margin-left:20px">Inicio de Edición</h2> 
              <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:300px; margin-top:20px" /> 
              </div>
          
              <div class="content">
                <p><strong>Hola ${usuario.primer_nombre},</strong></p>
          
                <p>
                  Se acerca la fecha de inicio de una edición.
                </p>
          
                <p style="font-size:16px;">
                  Edición: <strong>${edicion.nombre_edicion}</strong>
                </p>
                <p style="font-size:16px;">
                  Fecha de Inicio: <strong>${dayjs(edicion.fecha_inicio).format(
                    "DD [de] MMMM [de] YYYY",
                  )}</strong>
                </p>
          
                <p style="color:red;">
                  Faltan aproximadamente <strong>${dayjs(edicion.fecha_inicio)
                    .startOf("day")
                    .diff(
                      dayjs().startOf("day"),
                      "day",
                    )} días</strong> para el inicio.
                </p>
          
                <p>Este mensaje es para que puedas organizar y preparar todo con anticipación.</p>
          
                <p style="margin-top:30px;font-size:13px;color:#666;">
                  Este es un mensaje automático, por favor no responder.
                </p>
              </div>
          
              <div class="footer">
                <p>No responder a este correo.</p>
                <p>&copy; 2025 PAMCE. Todos los derechos reservados.</p>
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

module.exports = { notificarEdicion };

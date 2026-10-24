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
  Requisitos,
} = require("../models/index.js");
const dayjs = require("dayjs");
const NotificacionService = require("./notificaciones.js");
const path = require("path");
const localeEs = require("dayjs/locale/es");
dayjs.locale("es");

function validacionInicioEtapaConvocatoria() {
  console.log("validacionInicioEtapaConvocatoria");
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        console.log("validacionInicioEtapaConvocatoria Ingres");
        const hoy = dayjs().startOf("day");
        console.log("hoy", hoy);

        const edicion = await Edicion.findOne({
          where: {
            estado_edicion: "en_proceso",
            fecha_inicio_convocatoria: hoy,
          },
        });

        if (!edicion) {
          return;
        }

        console.log("edicion", edicion);

        const categorias = await Categoria.findAll({
          include: [
            {
              model: EdicionCategoria,
              as: "edicionesCategoria",
              required: true,
              where: {
                estado: "activo",
              },
              include: [
                {
                  model: Edicion,
                  as: "edicion",
                  required: true,
                  where: {
                    id_edicion: edicion.id_edicion,
                  },
                },
              ],
            },
          ],
          distinct: true,
          col: "id_categoria",
          subQuery: false,
        });

        const categoriasIncompletas = [];

        for (const categoria of categorias) {
          const idEdicionCategoria =
            categoria.edicionesCategoria[0].id_edicion_categoria;

          const motivos = [];

          const requisitos = await RequisitosEdicionCategoria.findAll({
            where: {
              id_edicion_categoria: idEdicionCategoria,
            },
            include: [
              {
                model: Requisitos,
                as: "Requisito",
                required: true,
              },
            ],
            distinct: true,
            subQuery: false,
          });

          if (requisitos.length === 0) {
            motivos.push("No tiene requisitos definidos");
          }

          const rubricas = await EdicionCategoriaRubrica.findAll({
            where: {
              id_edicion_categoria: idEdicionCategoria,
            },
            include: [
              {
                model: Rubrica,
                as: "rubrica",
                required: true,
                include: [
                  {
                    model: RubricaCriterio,
                    required: false,
                    include: [
                      {
                        model: EdicionCategoriaRubricaCriterio,
                        as: "edicionCategoriaRubricaCriterio",
                        required: false,
                      },
                    ],
                  },
                ],
              },
            ],
            distinct: true,
            subQuery: false,
          });

          if (rubricas.length === 0) {
            motivos.push("No tiene una rúbrica configurada");
          } else {
            const rubricaIncompleta = rubricas.some((r) => {
              const criterios = r.rubrica?.RubricaCriterios ?? [];

              if (criterios.length === 0) {
                return true;
              }

              const totalCriterios = criterios.reduce((suma, criterio) => {
                return (
                  suma +
                  Number(
                    criterio.edicionCategoriaRubricaCriterio?.[0]?.get(
                      "porcen",
                    ) ?? 0,
                  )
                );
              }, 0);

              return totalCriterios !== 100;
            });

            if (rubricaIncompleta) {
              motivos.push(
                "La rúbrica no tiene los criterios o porcentajes completos",
              );
            }

            const totalRubricas = rubricas.reduce((suma, rubrica) => {
              return suma + Number(rubrica.get("porcentaje") ?? 0);
            }, 0);

            if (totalRubricas !== 100) {
              motivos.push(
                `Los porcentajes de las rúbricas de la categoría deben sumar 100% (actualmente suman ${totalRubricas}%)`,
              );
            }
          }

          if (motivos.length > 0) {
            categoriasIncompletas.push({
              nombre: categoria.nombre_categoria,
              id_edicion_categoria: idEdicionCategoria,
              motivos,
            });
          }
        }

        if (categoriasIncompletas.length > 0) {
          for (const categoria of categoriasIncompletas) {
            await EdicionCategoria.update(
              {
                estado: "inactivo",
                observacion_inactivacion:
                  "Categoría desactivada por configuración incompleta de requisitos y/o rúbricas.",
                fecha_actualizacion: new Date(),
              },
              {
                where: {
                  id_edicion_categoria: categoria.id_edicion_categoria,
                },
              },
            );
          }
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

        const alertaCategorias =
          categoriasIncompletas.length > 0
            ? `
      <div style="font-family: system-ui, -apple-system, sans-serif; margin: 24px 0; padding: 20px; border-left: 4px solid #dc2626; background-color: #fef2f2; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); color: #1f2937; line-height: 1.6;">

        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
          <svg style="width: 22px; height: 22px; color: #dc2626; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <strong style="font-size: 16px; color: #991b1b;">
            Categorías desactivadas automáticamente
          </strong>
        </div>

        <p style="margin: 0 0 12px 0; font-size: 14px; color: #4b5563;">
          Al iniciar la etapa de convocatoria, las siguientes categorías fueron
          <strong>desactivadas automáticamente</strong> porque su configuración
          no cumplía los requisitos establecidos para participar en la etapa de convocatoria:
        </p>

        <ul style="margin: 0 0 16px 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;">
           ${categoriasIncompletas
             .map(
               (c, index) => `
                <div style="
                  padding: 14px 16px;
                  ${
                    index < categoriasIncompletas.length - 1
                      ? "border-bottom: 1px solid #f1f5f9;"
                      : ""
                  }
                ">

                  <div style="
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    margin-bottom: 7px;
                  ">

                    <strong style="
                      font-size: 14px;
                      color: #111827;
                    ">
                      ${c.nombre
                        .toLowerCase()
                        .replace(/\b\w/g, (letra) => letra.toUpperCase())}
                    </strong>

                  </div>

                  <div style="
                    margin-left: 16px;
                    padding-left: 12px;
                    border-left: 2px solid #fee2e2;
                  ">

                    ${c.motivos
                      .map(
                        (motivo) => `
                          <div style="
                            display: flex;
                            align-items: flex-start;
                            gap: 7px;
                            margin-bottom: 4px;
                            font-size: 13px;
                            color: #6b7280;
                          ">

                            <span style="
                              color: #dc2626;
                              font-size: 11px;
                              margin-top: 2px;
                            ">
                              •
                            </span>

                            <span>
                              ${motivo}
                            </span>

                          </div>
                        `,
                      )
                      .join("")}

                  </div>

                </div>
              `,
             )
             .join("")}
        </ul>

        <div style="margin-top:16px; padding:14px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; color:#7f1d1d; font-size:13.5px;">
          <strong>Importante:</strong>
          La desactivación de estas categorías es <strong>definitiva para la presente edición</strong>.
        </div>
      </div>
    `
            : "";

        for (const usuario of usuarios) {
          const notificacion = await NotificacionService.crear({
            tipo: "INICIO_ETAPA_CONVOCATORIA",
            titulo: `La etapa de convocatoria de la edición ${edicion.nombre_edicion} ha iniciado`,

            mensaje: `
            <p>Hola, administrador.</p>

            <p>
              Te informamos que la <b>etapa de convocatoria</b> de la edición
              <b>${edicion.nombre_edicion}</b> ha iniciado exitosamente.
            </p>

            <p>
              A partir de este momento, la configuración de los
              <b>requisitos y rúbricas</b> de las categorías ha quedado
              bloqueada, por lo que ya no es posible realizar modificaciones
              para la presente edición.
            </p>

            ${alertaCategorias}
          `,
            prioridad: "alta",
            id_usuario: usuario.id_usuario,
            id_rol: 2,
            datos: {
              edicion_id: edicion.id_edicion,
              fecha_inicio_convocatoria: edicion.fecha_inicio_convocatoria,
            },
          });

          const mensaje = {
            from: process.env.EMAIL_USER,
            to: [usuario.correo_electronico],
            subject: `La etapa de convocatoria de ${edicion.nombre_edicion} ha iniciado`,
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
                <p><strong>Hola ${usuario.primer_nombre},</strong></p>
          
                <p>
                  Te informamos que la <strong>etapa de convocatoria</strong> de la edición
                  <strong>${edicion.nombre_edicion}</strong> ha iniciado correctamente.
                </p>

                <p style="font-size:16px;">
                  Fecha de Inicio de la Etapa de Convocatoria: <strong>${dayjs(
                    edicion.fecha_inicio_convocatoria,
                  ).format("DD [de] MMMM [de] YYYY")}</strong>
                </p>
          
                 <p>
                  A partir de este momento, la configuración de los
                  <strong>requisitos y rúbricas</strong> de las categorías
                  ha quedado bloqueada para garantizar la integridad
                  y transparencia del proceso de convocatoria.
                </p>

          ${
            categoriasIncompletas.length > 0
              ? `
                    <div style="
                      margin-top:30px;
                      padding:22px;
                      border-left:5px solid #dc2626;
                      background:#fef2f2;
                      border-radius:10px;
                      text-align:left;
                    ">

                      <h3 style="
                        margin-top:0;
                        color:#991b1b;
                      ">
                        Categorías desactivadas automáticamente
                      </h3>

                      <p style="color:#4b5563;">
                        Durante la validación realizada al iniciar la
                        etapa de convocatoria, el sistema identificó
                        categorías cuya configuración no estaba completa.
                      </p>

                      ${categoriasIncompletas
                        .map(
                          (c) => `
                            <div style="
                              margin-top:15px;
                              padding:12px;
                              background:#ffffff;
                              border:1px solid #fecaca;
                              border-radius:8px;
                            ">

                              <strong style="
                                color:#111827;
                              ">
                                ${c.nombre
                                  .toLowerCase()
                                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                              </strong>

                              <div style="
                                margin-top:7px;
                                padding-left:12px;
                                border-left:2px solid #fee2e2;
                              ">

                                ${c.motivos
                                  .map(
                                    (motivo) => `
                                      <p style="
                                        margin:4px 0;
                                        font-size:13px;
                                        color:#6b7280;
                                      ">
                                        • ${motivo}
                                      </p>
                                    `,
                                  )
                                  .join("")}

                              </div>

                            </div>
                          `,
                        )
                        .join("")}

                      <div style="
                        margin-top:20px;
                        padding:14px;
                        background:#fff7ed;
                        border:1px solid #fed7aa;
                        border-radius:8px;
                        color:#9a3412;
                        font-size:13px;
                      ">

                        <strong>Importante:</strong>

                        La desactivación de estas categorías es
                        <strong>definitiva para la presente edición</strong>.

                      </div>

                    </div>
                  `
              : `
                    <div style="
                      margin-top:30px;
                      padding:20px;
                      background:#ecfdf5;
                      border-left:5px solid #16a34a;
                      border-radius:10px;
                      text-align:left;
                    ">

                      <h3 style="
                        margin-top:0;
                        color:#166534;
                      ">
                        Todas las categorías están correctamente configuradas
                      </h3>

                      <p>
                        Todas las categorías activas cumplieron con los
                        requisitos y la configuración de sus rúbricas,
                        por lo que el proceso de convocatoria continuará
                        con normalidad.
                      </p>

                    </div>
                  `
          }

          <p style="margin-top:35px;">
            Puedes ingresar al sistema para consultar el estado actual de la edición
            y realizar seguimiento al proceso de evaluación.
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

module.exports = { validacionInicioEtapaConvocatoria };

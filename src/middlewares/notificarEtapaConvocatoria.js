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
} = require("../models/index.js");
const dayjs = require("dayjs");
const NotificacionService = require("./notificaciones.js");
const path = require("path");
const localeEs = require("dayjs/locale/es");
dayjs.locale("es");

function notificarEtapaConvocatoria() {
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

        const diasRestantes = dayjs(edicion.fecha_inicio_convocatoria)
          .startOf("day")
          .diff(dayjs().startOf("day"), "day");

        if (![15, 7, 5, 3].includes(diasRestantes)) {
          return;
        }

        const requisitos_edicion = await RequisitosEdicion.findAll({
          where: {
            id_edicion: edicion.id_edicion,
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
              motivos,
            });
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

        if (diasRestantes !== 3 && categoriasIncompletas.length === 0) {
          return;
        }

        const alertaCategorias =
          categoriasIncompletas.length > 0
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
          margin-bottom: 8px;
        ">

          <strong style="
            font-size: 16px;
            color: #991b1b;
          ">
            Categorías con configuración incompleta
          </strong>
        </div>

        <p style="
          margin: 0 0 18px 42px;
          font-size: 14px;
          color: #4b5563;
        ">
          Las siguientes categorías aún requieren completar su configuración:
        </p>

        <div style="
          background-color: #ffffff;
          border: 1px solid #f3f4f6;
          border-radius: 8px;
          overflow: hidden;
        ">

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
            completa la configuración de las categorías antes de la fecha
            de inicio de la convocatoria.
          </p>
        </div>

      </div>
    `
            : "";

        const alertaRequisitos =
          requisitos_edicion.length === 0
            ? `
            <div style="font-family: system-ui, -apple-system, sans-serif; margin: 24px 0; padding: 20px; border-left: 4px solid #dc2626; background-color: #fef2f2; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); color: #1f2937; line-height: 1.6;">

        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
          <svg style="width: 22px; height: 22px; color: #dc2626; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>

          <strong style="font-size: 16px; color: #991b1b;">
            La edición no tiene requisitos definidos
          </strong>
        </div>

        <p style="margin: 0 0 12px 0; font-size: 14px; color: #4b5563;">
          Actualmente esta edición no cuenta con requisitos generales definidos para los participantes.
        </p>

        <p style="margin: 0 0 12px 0; font-size: 13.5px; color: #7f1d1d; background: #fee2e2; padding: 12px; border-radius: 8px; border: 1px dashed #fca5a5;">
          <strong>Importante:</strong>
          Antes del inicio de la convocatoria, verifica que todas las categorías de la
          edición cuenten con los <strong>requisitos y rúbricas completamente configurados</strong>
          para garantizar que los participantes conozcan las condiciones de postulación
          y que la evaluación pueda realizarse posteriormente.
        </p>

        <p style="margin: 0; font-size: 13.5px; color: #4b5563; font-style: italic;">
                Se recomienda completar la configuración de los requisitos de la edición antes de la fecha de inicio de la convocatoria.
              </p>

            </div>
          `
            : "";

        for (const usuario of usuarios) {
          const notificacion = await NotificacionService.crear({
            tipo: "ETAPA_CONVOCATORIA_PROXIMA",
            titulo: `La etapa de convocatoria de la edición ${edicion.nombre_edicion} inicia en ${diasRestantes} días`,
            mensaje: `
          <p>Hola, administrador.</p>
          <p>
            Te informamos que la <b>etapa de convocatoria</b> de la edición
            <b>${edicion.nombre_edicion}</b> iniciará en <b>${diasRestantes} días</b>.
          </p>
          <p><b>Fecha de inicio de la etapa de convocatoria:</b> ${edicion.fecha_inicio_convocatoria}</p>
          <p>
            Verifica que las categorías y demás configuraciones
            necesarias se encuentren completas antes del inicio de la etapa.
          </p>

          ${alertaCategorias}

          ${alertaRequisitos}
        `,
            prioridad: "alta",
            id_usuario: usuario.id_usuario,
            id_rol: 2,
            datos: {
              edicion_id: edicion.id_edicion,
              fecha_inicio_convocatoria: edicion.fecha_inicio_convocatoria,
              dias_restantes: diasRestantes,
            },
          });

          const mensaje = {
            from: process.env.EMAIL_USER,
            to: [usuario.correo_electronico],
            subject: `La etapa de convocatoria de ${edicion.nombre_edicion} inicia en ${diasRestantes} días`,
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
                <p><strong>Hola, ${usuario.primer_nombre},</strong></p>
          
                <p>
                  Te informamos que la <strong>etapa de convocatoria</strong> de la edición
                  <strong>${edicion.nombre_edicion}</strong> iniciará en
                  <strong>${diasRestantes} días</strong>.
                </p>

                <p style="font-size:16px;">
                  <strong>Fecha de inicio de la convocatoria:</strong><br>
                  ${dayjs(edicion.fecha_inicio_convocatoria).format("DD [de] MMMM [de] YYYY")}
                </p>

                <p>
                  Antes del inicio de la convocatoria, verifica que todas las categorías de la
                  edición cuenten con los <strong>requisitos necesarios</strong> para que los
                  participantes puedan conocer las condiciones de postulación.
                </p>
          
                <p>
                  Una vez iniciada la convocatoria, los
                  <strong>requisitos y rúbricas</strong> quedarán
                  <strong>bloqueados</strong> para garantizar la igualdad de condiciones
                  entre todos los participantes durante el proceso.
                </p>
          
                <div style="padding:1px;">
                  ${alertaCategorias}
                </div>

                <div style="padding:1px;">
                  ${alertaRequisitos}
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
        console.error("ERROR EN CRON");
        console.error(error);
      }
    },
    {
      timezone: "America/Bogota",
    },
  );
}

module.exports = { notificarEtapaConvocatoria };

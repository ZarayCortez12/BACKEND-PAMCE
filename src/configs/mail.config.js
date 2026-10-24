
// Escapa datos escritos por usuarios antes de insertarlos en el HTML del correo
const escaparHtml = (texto) =>
  String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const nodemailer = require("nodemailer");
const path = require("path");
const { send } = require("process");

const sendEmail = async (email, subject, html) => {
  const config = {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  };

  const mensaje = {
    from: process.env.EMAIL_USER,
    to: [email],
    subject,
    html,
  };

  const transport = nodemailer.createTransport(config);

  const info = await transport.sendMail(mensaje);
};

const sendEmailReset = async (recipient_email, OTP, name) => {
  const config = {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  };
  const mensaje = {
    from: process.env.EMAIL_USER,
    to: [recipient_email],
    subject: "Reestablecimiento de contraseña",
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; }
    .otp {
      background: linear-gradient(to right, #f54257 0, #e10318 100%);
      margin: 0 auto;
      width: max-content;
      padding: 0 10px;
      color: #fff;
      border-radius: 4px;
      font-size: 30px;
    }
  </style>
</head>
<body>
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="display:flex;align-items:center;border-bottom:1px solid #eee;padding-bottom:10px;">
    <h2 style="margin-top:10px;">Reestablecimiento de Contraseña</h2>
      <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:180px;" />
      
    </div>

    <p><strong>Hola ${escaparHtml(name)},</strong></p>
    <p>
      Hemos recibido tu solicitud de reestablecimiento de contraseña. 
      Por favor verifica tu identidad con este código de un solo uso (OTP):
    </p>

    <h2 class="otp">${OTP}</h2>
    <br/>
    <p>
      <strong>Este código solo es válido por 3 minutos.</strong><br/><br/>
      Si no solicitaste este cambio, ignora este mensaje.
    </p>

    <hr/>
    <p style="font-size:12px;color:#999;">No responder a este correo.</p>
    <p style="font-size:12px;color:#999;">&copy; 2025 PAMCE. Todos los derechos reservados.</p>
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

  const transport = nodemailer.createTransport(config);
  await transport.sendMail(mensaje);
};

const sendEmailConvocatoria = async (
  recipient_email,
  nombre_edicion,
  tokenEdicion,
) => {
  try {
    const config = {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };

    const linkFormulario = `${process.env.FRONTEND_URL}/inscripcion-edicion/${tokenEdicion}`;

    const mensaje = {
      from: process.env.EMAIL_USER,
      to: [recipient_email],
      subject: `🎓 Invitación a participar en la ${nombre_edicion}`,
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
    <h2 style="margin-top:30px; color:#e10318;margin-left:20px">Invitación a Participar</h2> 
    <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:300px; margin-top:20px" /> 
    </div>

    <div class="content">
      <h2>${escaparHtml(nombre_edicion)}</h2>
      <p>
        ¡Nos complace invitarte a participar en la <strong>${escaparHtml(nombre_edicion)}</strong> 
        del <strong>Premio Anual al Mérito Científico y Empresarial (PAMCE)</strong>!
      </p>
      <p>
        Forma parte de esta iniciativa que reconoce la excelencia, la innovación y 
        el compromiso con el desarrollo científico y empresarial.
      </p>

      <a class="btn" href="${linkFormulario}" target="_blank">📝 Completar Formulario</a>

      <p style="margin-top:20px;font-size:13px;">
        O copia este enlace en tu navegador:<br/>
        <span style="color:#e10318;word-break:break-all;">${linkFormulario}</span>
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

    const transport = nodemailer.createTransport(config);
    await transport.sendMail(mensaje);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const sendEmailCrearContrasena = async (
  recipient_email,
  primer_nombre,
  enlaceCreacion,
) => {
  const config = {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  };

  const mensaje = {
    from: process.env.EMAIL_USER,
    to: [recipient_email],
    subject: `Termina tu proceso de registro a PAMCE`,
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
    <h2 style="margin-top:30px;margin-left:20px">Creacion de Contraseña</h2> 
    <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:300px; margin-top:20px" /> 
    </div>

    <div class="content">
      <h2>Hola, ${escaparHtml(primer_nombre)}</h2>
      <p>
        Este correo es para confirmar que has sido registrado a PAMCE. 
        Ahora debes crear una contraseña para tu cuenta.
      </p>

      <a class="btn" href="${enlaceCreacion}" target="_blank">🔐 Crear Contraseña</a>

      <p style="margin-top:20px;font-size:13px;">
        O copia este enlace en tu navegador:<br/>
        <span style="color:#e10318;word-break:break-all;">${enlaceCreacion}</span>
      </p>
      <p style="margin-top:20px;font-size:13px;">
        Si no has solicitado el registro a PAMCE, ignora este correo.
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

  const transport = nodemailer.createTransport(config);
  await transport.sendMail(mensaje);
};

const sendEmailConfirmacionPostulacion = async (
  recipient_email,
  nombreUsuario,
  nombreEdicion,
  nombreCategoria,
) => {
  try {
    const config = {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };

    const mensaje = {
      from: process.env.EMAIL_USER,
      to: [recipient_email],
      subject: `Confirmación de postulación – ${nombreEdicion}`,
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
    <h2 style="margin-top:30px; color:#e10318;margin-left:20px">Postulación recibida</h2> 
    <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:300px; margin-top:20px" /> 
    </div>

    <div class="content">
      <p><strong>Hola ${escaparHtml(nombreUsuario)},</strong></p>

      <p>
        Hemos recibido correctamente tu postulación a la edición:
      </p>

      <p style="font-size:16px;">
        <strong>${escaparHtml(nombreEdicion)}</strong><br/>
        Categoría: <strong>${escaparHtml(nombreCategoria)}</strong>
      </p>

      <p>
        Nuestro equipo revisará tu información y te notificará
        cualquier novedad a través de este correo electrónico.
      </p>

      <p style="margin-top:20px;">
        Gracias por participar en el
        <strong>Premio Anual al Mérito Científico y Empresarial (PAMCE)</strong>.
      </p>

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

    const transport = nodemailer.createTransport(config);
    await transport.sendMail(mensaje);

    return true;
  } catch (error) {
    console.error("Error enviando correo de confirmación:", error);
    return false;
  }
};

const sendEmailAceptarPostulacion = async (
  recipient_email,
  nombre_participante,
  nombre_edicion,
  nombre_categoria,
) => {
  try {
    const config = {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };

    const mensaje = {
      from: process.env.EMAIL_USER,
      to: [recipient_email],
      subject: `🎉 Postulación Aceptada ${nombre_categoria} de ${nombre_edicion}`,
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
    <h2 style="margin-top:30px; color:#e10318;margin-left:20px">Postulación Aprobada</h2> 
    <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:300px; margin-top:20px" /> 
    </div>

    <div class="content">
      <h2>¡Felicidades, ${escaparHtml(nombre_participante)}!</h2>
      <h3>Tu postulación ha sido aceptada</h3>
      
      <p>
        Nos complace informarte que, tras revisar detalladamente tu documentación, tu postulación a la categoría <strong>${escaparHtml(nombre_categoria)}</strong> en la <strong>${escaparHtml(nombre_edicion)}</strong> ha sido aprobada exitosamente.
      </p>

      <p style="margin-top:30px; font-size:13px; color: #888;">
        Te invitamos a estar atento a tu correo electrónico y a la plataforma para conocer los siguientes pasos del proceso.
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

    const transport = nodemailer.createTransport(config);
    await transport.sendMail(mensaje);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const sendEmailRechazarPostulacion = async (
  recipient_email,
  nombre_participante,
  nombre_edicion,
  nombre_categoria,
) => {
  try {
    const config = {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };

    const mensaje = {
      from: process.env.EMAIL_USER,
      to: [recipient_email],
      subject: `Información sobre su postulación a ${nombre_categoria} de ${nombre_edicion}`,
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
    <h2 style="margin-top:30px; color:#e10318;margin-left:20px">Estado Postulación</h2> 
    <img src="cid:logoPamce" alt="PAMCE" style="max-height:50px; margin-left:300px; margin-top:20px" /> 
    </div>

    <div class="content">
      <h2>Estimado(a) ${escaparHtml(nombre_participante)},</h2>
      
      <p>
        Agradecemos sinceramente su interés en participar en la <strong>${escaparHtml(nombre_edicion)}</strong> 
        del Premio Anual al Mérito Científico y Empresarial (PAMCE).
      </p>

      <p>
        Tras realizar la fase de revisión técnica de su postulación en la categoría <strong>${escaparHtml(nombre_categoria)}</strong>, 
        lamentamos informarle que en esta ocasión no ha sido posible aceptar su participación.
      </p>

      <p style="font-size: 14px;">
        Valoramos el esfuerzo dedicado a su postulación y le animamos a continuar fortaleciendo sus procesos para futuras ediciones de nuestro programa.
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

    const transport = nodemailer.createTransport(config);
    await transport.sendMail(mensaje);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const sendEmailNotification = async (recipient_email, mensaje) => {
  try {
    const config = {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };

    const transport = nodemailer.createTransport(config);
    await transport.sendMail(mensaje);

    return true;
  } catch (error) {
    console.error("Error enviando correo de confirmación:", error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendEmailReset,
  sendEmailConvocatoria,
  sendEmailCrearContrasena,
  sendEmailConfirmacionPostulacion,
  sendEmailAceptarPostulacion,
  sendEmailRechazarPostulacion,
  sendEmailNotification,
};

const sanitizeHtml = require("sanitize-html");

// Etiquetas y atributos que usan los mensajes de notificación del sistema.
// Todo lo demás (scripts, eventos como onerror, enlaces javascript:) se elimina,
// así un nombre escrito por un usuario no puede ejecutar código en el navegador.
const OPCIONES = {
  allowedTags: [
    "p", "div", "span", "b", "strong", "i", "em", "u", "br",
    "ul", "ol", "li", "h2", "h3", "h4", "svg", "path",
  ],
  allowedAttributes: {
    "*": ["style"],
    svg: ["xmlns", "fill", "viewBox", "stroke-width", "stroke", "width", "height"],
    path: ["d", "stroke-linecap", "stroke-linejoin"],
  },
  parser: { lowerCaseAttributeNames: false },
};

const sanitizarHtml = (html) => sanitizeHtml(String(html ?? ""), OPCIONES);

module.exports = { sanitizarHtml };

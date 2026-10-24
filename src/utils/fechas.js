const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
require("dayjs/locale/es");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("es");

const ZONA_HORARIA = "America/Bogota";

// Fecha y hora actual en Colombia, sin importar la zona horaria del servidor
const ahoraBogota = () => dayjs().tz(ZONA_HORARIA);

// Fecha de hoy en Colombia como "YYYY-MM-DD", igual al formato de los campos DATEONLY
const hoyBogota = () => ahoraBogota().format("YYYY-MM-DD");

module.exports = { dayjs, ZONA_HORARIA, ahoraBogota, hoyBogota };

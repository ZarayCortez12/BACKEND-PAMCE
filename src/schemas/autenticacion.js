import { z } from "zod";

export const actualizarDatos = z
  .object({
    correo: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo no tiene un formato válido"),

    telefono: z
      .string()
      .trim()
      .regex(/^(\+57)?[0-9]{10}$/, "El teléfono debe tener 10 dígitos"),

    direccion: z
      .string()
      .trim()
      .min(5, "La dirección es muy corta")
      .max(255, "La dirección es demasiado larga"),
  })
  .partial();

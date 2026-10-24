-- Limpieza de datos causada por un bug ya corregido: al postularse desde el
-- formulario público se asignaba el rol de jurado (id_rol 3) en lugar del de
-- participante (4).
--
-- Quita el rol de jurado SOLO a usuarios que:
--   1. lo recibieron el mismo día de su primera postulación, y
--   2. nunca fueron asignados como jurados.
--
-- Uso: revisar primero el SELECT; si la lista es correcta, ejecutar todo el
-- archivo. Si algo no cuadra, cambiar COMMIT por ROLLBACK.

BEGIN;

-- 1. Vista previa de los usuarios afectados
SELECT u.id_usuario,
       u.primer_nombre || ' ' || u.primer_apellido AS nombre,
       ur.fecha_registro::date AS jurado_desde
FROM usuario_rol ur
JOIN usuarios u ON u.id_usuario = ur.id_usuario
WHERE ur.id_rol = 3
  AND ur.fecha_registro::date = (
        SELECT MIN(p.fecha_postulacion)::date
        FROM participacion p
        WHERE p.id_usuario = ur.id_usuario
      )
  AND NOT EXISTS (
        SELECT 1 FROM participacion_jurado pj WHERE pj.id_jurado = ur.id_usuario
      )
ORDER BY u.id_usuario;

-- 2. Eliminación del rol de jurado asignado por error
DELETE FROM usuario_rol ur
WHERE ur.id_rol = 3
  AND ur.fecha_registro::date = (
        SELECT MIN(p.fecha_postulacion)::date
        FROM participacion p
        WHERE p.id_usuario = ur.id_usuario
      )
  AND NOT EXISTS (
        SELECT 1 FROM participacion_jurado pj WHERE pj.id_jurado = ur.id_usuario
      );

COMMIT;

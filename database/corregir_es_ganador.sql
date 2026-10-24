-- Corrección de datos causada por un bug ya corregido: el modelo Participacion
-- no tenía el campo es_ganador, así que la premiación nunca lo guardó y los
-- certificados de los ganadores decían "participación".
--
-- En las ediciones ya premiadas, marca es_ganador según el puesto (igual que
-- la premiación corregida): con puesto -> ganador; sin puesto -> no ganador.
-- Solo toca filas donde es_ganador está vacío.
--
-- Uso: revisar primero el SELECT; si la lista es correcta, ejecutar todo el
-- archivo. Si algo no cuadra, cambiar COMMIT por ROLLBACK.

BEGIN;

-- 1. Vista previa
SELECT e.nombre_edicion,
       p.id_participacion,
       p.calificacion_final,
       p.puesto,
       (p.puesto IS NOT NULL) AS quedara_como_ganador
FROM participacion p
JOIN ediciones e ON e.id_edicion = p.id_edicion
WHERE p.estado = 'evaluada'
  AND p.es_ganador IS NULL
  AND e.fecha_procesamiento_premiacion IS NOT NULL
ORDER BY e.nombre_edicion, p.puesto NULLS LAST;

-- 2. Corrección
UPDATE participacion p
SET es_ganador = (p.puesto IS NOT NULL)
FROM ediciones e
WHERE e.id_edicion = p.id_edicion
  AND p.estado = 'evaluada'
  AND p.es_ganador IS NULL
  AND e.fecha_procesamiento_premiacion IS NOT NULL;

COMMIT;

-- Descripción corta de cada subtema, la que el mapa de fases enseña bajo el
-- título del nodo para que la docente sepa qué hay dentro antes de abrirlo.
--
-- Nullable y sin DEFAULT: durante el rollout de Cloud Run conviven la revisión
-- vieja —que no nombra la columna al insertar— y la nueva. Nulo y vacío
-- significan lo mismo: "sin descripción", y el nodo se pinta como antes.
ALTER TABLE topic_subtopics
    ADD COLUMN description VARCHAR(200);

-- Las tres fases de "Practicar autocuidado", el único tema que hoy es un mapa.
-- Los dos ids porque V16 solo fusiona donde existían los dos: en producción el
-- tema se llama `practicar-autocuidado`, en una base nueva `autocuidado`. A
-- partir de aquí el texto se edita desde el CMS.
UPDATE topic_subtopics s
   SET description = v.description
  FROM (VALUES
        ('cuidando-mis-emociones',
         'Reconocer, nombrar y comprender lo que sientes para responder con más calma a los desafíos del día.'),
        ('cuidando-mi-cuerpo',
         'Descanso, alimentación y movimiento: pequeños hábitos que también sostienen tu bienestar emocional.'),
        ('cuidando-mi-mente',
         'Pausas que le devuelven a tu mente la energía, la concentración y la creatividad.')
       ) AS v(subtopic_key, description)
 WHERE s.topic_id IN ('autocuidado', 'practicar-autocuidado')
   AND s.subtopic_key = v.subtopic_key;

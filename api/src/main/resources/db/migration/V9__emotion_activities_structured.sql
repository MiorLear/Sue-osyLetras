-- Sugerencias del cliente (sep 2026): la tarjeta de una actividad debe mostrar
-- propósito, duración y edades en el resumen, y objetivo, materiales, paso a
-- paso y preguntas al desplegarla. Una actividad era una cadena suelta dentro
-- del JSONB `activities`, así que no había dónde guardar nada de eso.
--
-- Cada cadena pasa a ser un objeto que solo lleva el título. El resto queda
-- vacío a propósito: ese contenido no existe en ninguna parte de donde sacarlo,
-- y rellenarlo con valores plausibles sería inventar material pedagógico que
-- una docente leería como real. Se completa desde el CMS.

UPDATE emotion_content
SET activities = COALESCE((
        SELECT jsonb_agg(
                   CASE WHEN jsonb_typeof(item) = 'string'
                        THEN jsonb_build_object(
                                 'title', item #>> '{}',
                                 'purpose', '',
                                 'duration', '',
                                 'ages', '',
                                 'materials', '',
                                 'steps', '[]'::jsonb,
                                 'questions', '[]'::jsonb)
                        ELSE item
                   END)
        FROM jsonb_array_elements(activities) item), '[]')
WHERE jsonb_array_length(activities) > 0;

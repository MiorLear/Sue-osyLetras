-- V9 dio por hecho que una actividad cargada era solo un nombre, y por eso metió
-- la cadena entera en `title` y dejó el resto vacío. Eso es cierto para lo que
-- siembra DataSeeder ("Caja de los planes B"), pero no para producción: ahí las
-- 43 actividades vienen del material de Sueños y Letras y ya traen todo dentro
-- de la misma cadena, con etiquetas:
--
--   El mural de las cosas buenas — Objetivo: ... Duración: 20 minutos.
--   Edades: 5 a 15 años. Materiales: ... Instrucciones: ...
--   Preguntas para reflexionar: ¿...? ¿...?
--
-- Sin esta migración la tarjeta rediseñada muestra un párrafo de 750 caracteres
-- como título en negrita y debajo "Sin detalle todavía", que se lee peor que el
-- texto corrido de antes. El contenido sí existe; solo hay que repartirlo.
--
-- Es conservadora a propósito: una actividad que no traiga ninguna etiqueta
-- conocida —las tres del semillero, y las dos entradas que en realidad son
-- "Historias sugeridas: ..."— se queda exactamente como está. Nada se inventa y
-- nada se pierde: lo que no case con una etiqueta sigue siendo el título.

CREATE FUNCTION explorarte_parse_activity(raw text) RETURNS jsonb AS $$
DECLARE
    -- chr(1) abre cada etiqueta y chr(2) la separa de su valor. Marcar y cortar
    -- es más fiable que una expresión por campo: el orden de las etiquetas varía
    -- (unas traen "Instrucciones", otras "Desarrollo" o "Cómo jugar") y así
    -- cada valor termina donde empieza la siguiente etiqueta, sea cual sea.
    labels   constant text :=
        '(Objetivo|Duración|Edades|Materiales|Instrucciones|Desarrollo|Cómo jugar'
        || '|Preguntas para reflexionar|Preguntas para conversar):[[:space:]]*';
    marked   text;
    chunks   text[];
    chunk    text;
    label    text;
    value    text;
    title     text;
    purpose   text := '';
    duration  text := '';
    ages      text := '';
    materials text := '';
    steps_txt text := '';
    quest_txt text := '';
    steps     jsonb := '[]'::jsonb;
    questions jsonb := '[]'::jsonb;
BEGIN
    -- chr() en vez de E'\x01': en una cadena E, el \1 de la retrorreferencia se
    -- lee como escape octal y el nombre de la etiqueta desaparece del resultado.
    marked := regexp_replace(raw, labels, chr(1) || '\1' || chr(2), 'g');
    chunks := string_to_array(marked, chr(1));

    -- Ninguna etiqueta: no hay nada que repartir.
    IF array_length(chunks, 1) IS NULL OR array_length(chunks, 1) < 2 THEN
        RETURN NULL;
    END IF;

    -- El título es lo que va antes de la primera etiqueta, sin el guión que lo
    -- separaba de ella.
    title := btrim(regexp_replace(btrim(chunks[1]), '[[:space:]]*[—–-]$', ''));

    -- La cadena empieza por una etiqueta ("Historias sugeridas: ..." cae aquí
    -- porque su etiqueta no está en la lista y lo que sí casa va más adelante):
    -- sin título no se puede afirmar qué es cada parte.
    IF title = '' THEN
        RETURN NULL;
    END IF;

    FOR i IN 2 .. array_length(chunks, 1) LOOP
        chunk := chunks[i];
        label := split_part(chunk, chr(2), 1);
        value := btrim(split_part(chunk, chr(2), 2));

        CASE label
            WHEN 'Objetivo' THEN purpose := value;
            -- El punto final sobra en un chip de "⏱ 20 minutos."
            WHEN 'Duración' THEN duration := btrim(rtrim(value, '.'));
            WHEN 'Edades'   THEN ages     := btrim(rtrim(value, '.'));
            WHEN 'Materiales' THEN materials := value;
            WHEN 'Instrucciones' THEN steps_txt := value;
            WHEN 'Desarrollo'    THEN steps_txt := value;
            WHEN 'Cómo jugar'    THEN steps_txt := value;
            WHEN 'Preguntas para reflexionar' THEN quest_txt := value;
            WHEN 'Preguntas para conversar'   THEN quest_txt := value;
            ELSE NULL;
        END CASE;
    END LOOP;

    -- Un paso por pregunta: el signo de cierre delimita sin ambigüedad.
    IF quest_txt <> '' THEN
        SELECT COALESCE(jsonb_agg(btrim(m[1])), '[]'::jsonb) INTO questions
        FROM regexp_matches(quest_txt, '[^?]+\?', 'g') AS m;
        IF questions = '[]'::jsonb THEN
            questions := jsonb_build_array(quest_txt);
        END IF;
    END IF;

    -- Solo se corta el paso a paso cuando viene numerado ("1) ... 2) ..."), que
    -- no admite interpretación. Partir prosa por el punto convertiría una frase
    -- con una abreviatura o un "4-8 años)" en dos pasos falsos, así que el resto
    -- se queda como un paso único: se lee igual y no inventa estructura.
    -- El ordinal tiene que ir pegado a un espacio o al principio: así "(3-6
    -- años)" o "4-8 años)" dentro del texto no cuentan como un paso nuevo.
    IF steps_txt <> '' THEN
        IF (SELECT count(*)
            FROM regexp_matches(steps_txt, '(^|[[:space:]])[0-9]{1,2}\)[[:space:]]', 'g')) >= 2 THEN
            -- El corte se come el ordinal salvo el del primer paso, que no
            -- lleva espacio delante; por eso se quita después en todos.
            SELECT COALESCE(jsonb_agg(btrim(regexp_replace(s, '^[0-9]{1,2}\)[[:space:]]*', ''))
                                      ORDER BY n), '[]'::jsonb)
            INTO steps
            FROM regexp_split_to_table(steps_txt, '[[:space:]]+[0-9]{1,2}\)[[:space:]]+')
                 WITH ORDINALITY AS t(s, n)
            WHERE btrim(s) <> '';
        ELSE
            steps := jsonb_build_array(steps_txt);
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'title', title,
        'purpose', purpose,
        'duration', duration,
        'ages', ages,
        'materials', materials,
        'steps', steps,
        'questions', questions);
END;
$$ LANGUAGE plpgsql;

UPDATE emotion_content
SET activities = COALESCE((
        SELECT jsonb_agg(
                   -- Solo se reparte la actividad que V9 dejó sin detalle. Una
                   -- que ya venga por campos desde el CMS no se vuelve a tocar.
                   CASE WHEN item->>'purpose' = ''
                             AND item->'steps' = '[]'::jsonb
                             AND item->'questions' = '[]'::jsonb
                        THEN COALESCE(explorarte_parse_activity(item->>'title'), item)
                        ELSE item
                   END
                   ORDER BY idx)
        FROM jsonb_array_elements(activities) WITH ORDINALITY AS a(item, idx)), '[]')
WHERE jsonb_array_length(activities) > 0;

DROP FUNCTION explorarte_parse_activity(text);

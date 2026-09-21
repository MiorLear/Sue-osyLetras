-- Fusiona los tres temas que V15 duplicó en producción.
--
-- V15 escribió su contenido con los ids del seed —`autocuidado`,
-- `salud-mental`, `aula`— dando por hecho que eran los de producción. No lo
-- eran: allí los temas los había creado una administradora desde el CMS, y su
-- id sale de slugificar el título completo (`practicar-autocuidado`,
-- `por-que-importa-la-salud-mental-en-la-infancia`,
-- `como-acompanar-emociones-dificiles-en-el-aula`). Como el `ON CONFLICT (id)`
-- no encontró contra qué chocar, en vez de actualizar insertó tres temas
-- nuevos: la pantalla de Aprendiendo pasó a enseñar seis.
--
-- Qué se conserva de cada lado, y por qué:
--
--   * El **id** del tema original. Es lo que ya conocen los enlaces guardados,
--     y lo que apuntaría cualquier avance anterior.
--   * El **contenido** del tema de V15. Los originales traían el mismo texto,
--     pero V12 solo pudo convertirlo a párrafos sueltos porque venía de una
--     columna de texto plano; el de V15 trae las listas, los cuadros de
--     "Recuerda", las preguntas y las definiciones con su forma propia. Cuando
--     se comprobó, ninguno de los 28 subtemas de ninguno de los dos lados tenía
--     archivos subidos, así que la fusión no puede dejar un PDF huérfano.
--
-- Es condicional a propósito: en una base nueva —local, CI— los temas
-- originales no existen, V15 ya deja los suyos bien y esta migración no hace
-- nada.

DO $$
DECLARE
    par RECORD;
BEGIN
    FOR par IN
        SELECT * FROM (VALUES
            ('autocuidado',  'practicar-autocuidado'),
            ('salud-mental', 'por-que-importa-la-salud-mental-en-la-infancia'),
            ('aula',         'como-acompanar-emociones-dificiles-en-el-aula')
        ) AS t(duplicado, original)
    LOOP
        -- Solo si los DOS existen. Si el original no está, V15 ya hizo lo
        -- correcto y no hay nada que fusionar.
        CONTINUE WHEN NOT EXISTS (SELECT 1 FROM topics WHERE id = par.original)
                   OR NOT EXISTS (SELECT 1 FROM topics WHERE id = par.duplicado);

        -- 1. El avance que apuntara al duplicado se muda al original. Va
        --    primero, mientras las dos filas de `topics` siguen existiendo: al
        --    revés, el ON DELETE CASCADE del paso 4 se lo llevaría por delante.
        --    ON CONFLICT por si la misma docente ya tenía esa fase marcada en
        --    los dos, que con las claves repetidas es posible.
        UPDATE learning_progress p
           SET topic_id = par.original
         WHERE p.topic_id = par.duplicado
           AND NOT EXISTS (
               SELECT 1 FROM learning_progress q
                WHERE q.user_id = p.user_id
                  AND q.topic_id = par.original
                  AND q.subtopic_key = p.subtopic_key);
        DELETE FROM learning_progress WHERE topic_id = par.duplicado;

        -- 2. Fuera los subtemas del original: su contenido es el mismo texto
        --    pero aplanado a párrafos, y el bueno viene en el paso 3.
        DELETE FROM topic_subtopics WHERE topic_id = par.original;

        -- 3. Los subtemas del duplicado pasan a colgar del original, con sus
        --    bloques, su emoji y su orden intactos. Un UPDATE y no un
        --    INSERT ... SELECT: así no hay que repetir el contenido aquí ni
        --    tocar la secuencia.
        UPDATE topic_subtopics SET topic_id = par.original WHERE topic_id = par.duplicado;

        -- 4. El original hereda la forma de recorrido y la introducción, y el
        --    duplicado desaparece.
        UPDATE topics o
           SET layout = d.layout,
               intro  = d.intro,
               emoji  = d.emoji,
               title  = d.title
          FROM topics d
         WHERE o.id = par.original AND d.id = par.duplicado;

        DELETE FROM topics WHERE id = par.duplicado;
    END LOOP;
END $$;

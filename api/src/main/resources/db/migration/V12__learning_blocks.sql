-- El cuerpo de un subtema deja de ser un TEXT suelto y pasa a ser una lista de
-- bloques con forma declarada: párrafo, título, lista de prácticas, lista de lo
-- que evitar, cuadro de "Recuerda", preguntas para reflexionar, frase modelo y
-- lista de definiciones.
--
-- El material de las docentes nunca tuvo la forma de un párrafo corrido, así
-- que lo que cabía en `body` era siempre un resumen. Un tema gana además su
-- propia introducción y la forma en que se recorre (acordeón, mapa de fases o
-- tarjetas), y un subtema gana emoji —los nodos del mapa— y una CLAVE ESTABLE.
--
-- La clave es lo único de aquí que no es cosmético. El PUT del CMS hace
-- clear() + addAll() sobre la colección, así que los BIGSERIAL de
-- topic_subtopics se REGENERAN en cada guardado: cualquier avance indexado por
-- ese id —o por la posición, que además se reordena— se perdería sin que nadie
-- lo notara. subtopic_key es el único identificador que sobrevive a un guardado
-- del CMS, y es sobre el que se apoya learning_progress (V13).


-- ── El slug, en un solo sitio ───────────────────────────────────────────────
--
-- V12 la usa para las claves de lo ya cargado y V15 para volver a enganchar los
-- archivos subidos. Tenerla escrita dos veces sería tenerla escrita mal una de
-- las dos: basta con que un truncado no coincida para que los medios de una
-- fase queden huérfanos, y en silencio.
--
-- `unaccent` no está: es una extensión, y crearla exige privilegios que Cloud
-- SQL no concede al usuario de la aplicación. translate() hace lo mismo para el
-- español y no depende de nada.
CREATE OR REPLACE FUNCTION explorarte_slug(txt TEXT) RETURNS TEXT AS $$
    SELECT COALESCE(NULLIF(
        regexp_replace(
            left(
                regexp_replace(
                    regexp_replace(
                        translate(lower(COALESCE(txt, '')),
                                  'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                                  'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'),
                        '[^a-zA-Z0-9]+', '-', 'g'),
                    '^-+|-+$', '', 'g'),
                48),
            '-+$', '', 'g'), ''), 'paso');
$$ LANGUAGE SQL IMMUTABLE;

COMMENT ON FUNCTION explorarte_slug(TEXT) IS
    'Slug estable para las claves de subtema. Espejo de LearningController.slugify(); si cambia una, cambia la otra.';


-- ── Columnas nuevas ─────────────────────────────────────────────────────────

ALTER TABLE topics
    ADD COLUMN layout VARCHAR(16) NOT NULL DEFAULT 'ACCORDION',
    ADD COLUMN intro  JSONB       NOT NULL DEFAULT '[]';

-- Mayúsculas a propósito: @Enumerated(EnumType.STRING) guarda el name() del
-- enum, no el valor de @JsonValue. Es lo mismo que ya pasa con
-- calendar_events.type ('SESION' en la columna, 'sesión' en el JSON). Escribir
-- aquí los valores en minúscula daría una violación de CHECK en el primer
-- guardado del CMS, y ddl-auto: validate no puede detectarlo.
ALTER TABLE topics
    ADD CONSTRAINT topics_layout_known
        CHECK (layout IN ('ACCORDION', 'PATH', 'SLIDES'));

ALTER TABLE topic_subtopics
    ADD COLUMN emoji        VARCHAR(16),
    ADD COLUMN subtopic_key VARCHAR(64),
    ADD COLUMN blocks       JSONB NOT NULL DEFAULT '[]';


-- ── body → blocks ───────────────────────────────────────────────────────────
--
-- Se parte por línea en blanco, que es lo que la administradora usaba como
-- separador de párrafo en el textarea del CMS. NO se parte por punto: eso
-- convertiría una abreviatura en un párrafo que nadie escribió, que es
-- exactamente la trampa que V10 tuvo que sortear.
WITH parrafos AS (
    SELECT s.id,
           jsonb_agg(jsonb_build_object('kind', 'paragraph', 'text', btrim(p.texto))
                     ORDER BY p.orden) AS bloques
      FROM topic_subtopics s
      CROSS JOIN LATERAL regexp_split_to_table(COALESCE(s.body, ''), '\r?\n[ \t]*\r?\n')
                 WITH ORDINALITY AS p(texto, orden)
     WHERE btrim(p.texto) <> ''
     GROUP BY s.id
)
UPDATE topic_subtopics s
   SET blocks = parrafos.bloques
  FROM parrafos
 WHERE parrafos.id = s.id
   AND jsonb_array_length(s.blocks) = 0;


-- ── Claves de lo ya cargado ─────────────────────────────────────────────────

WITH base AS (
    SELECT id, topic_id, position, explorarte_slug(title) AS slug
      FROM topic_subtopics
     WHERE subtopic_key IS NULL
), numerada AS (
    SELECT id, slug,
           row_number() OVER (PARTITION BY topic_id, slug
                              ORDER BY position NULLS LAST, id) AS n
      FROM base
)
UPDATE topic_subtopics s
   -- El desempate usa el id de la fila, no un contador: un contador podría
   -- chocar con un slug que ya terminara en "-2", y eso sería un arranque
   -- fallido en producción en vez de un test rojo.
   SET subtopic_key = CASE WHEN numerada.n = 1 THEN numerada.slug
                           ELSE numerada.slug || '-' || numerada.id END
  FROM numerada
 WHERE numerada.id = s.id;

ALTER TABLE topic_subtopics
    ALTER COLUMN subtopic_key SET NOT NULL;

-- DEFERRABLE INITIALLY DEFERRED a propósito. El PUT del CMS borra y reinserta
-- TODAS las fases de un tema en el mismo flush; que Hibernate ordene los
-- borrados antes de las altas es cierto hoy, pero no es un contrato que
-- convenga apostar en producción. Diferida, la comprobación ocurre al COMMIT y
-- el orden dentro de la transacción deja de importar.
ALTER TABLE topic_subtopics
    ADD CONSTRAINT topic_subtopics_key_unique UNIQUE (topic_id, subtopic_key)
        DEFERRABLE INITIALLY DEFERRED;


-- ── body se queda, obsoleta ─────────────────────────────────────────────────
--
-- Y no por nostalgia. Es NOT NULL sin default: en cuanto la entidad deja de
-- mapearla, el INSERT que genera Hibernate no la nombra y cada alta de subtema
-- sería un error. DROP COLUMN lo arregla, pero rompe la ventana de convivencia
-- del despliegue —Cloud Run sirve la revisión vieja y la nueva a la vez durante
-- el rollout, y la vieja hace SELECT body— y además la nombran
-- MigrationChainTest y scripts/migrate-media-urls.sql. Nullable con default
-- vacío cubre los dos lados; la columna se elimina en una migración propia del
-- siguiente release, cuando no quede ninguna revisión que la lea.
-- ddl-auto: validate no se queja de una columna que la entidad no mapea.
ALTER TABLE topic_subtopics
    ALTER COLUMN body DROP NOT NULL,
    ALTER COLUMN body SET DEFAULT '';

COMMENT ON COLUMN topic_subtopics.body IS
    'Obsoleta desde V12: el contenido vive en blocks. Se elimina en el release siguiente.';

-- GCP-04 — reescribe las URLs de medios ya guardadas, de Supabase Storage a la
-- forma canonica que sirve la API (GET /media/**).
--
--   antes:  https://<ref>.supabase.co/storage/v1/object/public/explorarte-media/posts/<uuid>-<archivo>
--   despues: https://explorarte-prod.web.app/media/posts/<uuid>-<archivo>
--
-- La ruta dentro del bucket (<categoria>/<uuid>-<archivo>) no cambia, porque
-- scripts/migrate-storage-to-gcs.sh copia conservandola. Por eso esto es una
-- sustitucion de prefijo y no un mapeo objeto por objeto.
--
-- ESTE ES EL MOMENTO DEL CORTE. Hasta que corra, los clientes leen de Supabase;
-- despues, de Cloud Storage. Correr solo cuando la copia de objetos haya
-- terminado sin fallos.
--
-- Consecuencia que hay que anunciar antes de correrlo: cambian TODAS las URLs
-- de medios, asi que todo archivo ya descargado en un telefono queda invalidado
-- y se vuelve a bajar una vez, la proxima vez que ese telefono tenga red. Para
-- una docente con varios videos guardados eso puede ser bastante trafico de una
-- sola vez. Conviene hacerlo en horario de poco uso y avisarlo.
--
-- Uso:
--   psql "$CLOUD_SQL_URL" \
--     -v old_prefix="https://<ref>.supabase.co/storage/v1/object/public/explorarte-media/" \
--     -v new_prefix="https://explorarte-prod.web.app/media/" \
--     -f scripts/migrate-media-urls.sql
--
-- Todo va dentro de una transaccion: o se reescribe todo o no se reescribe
-- nada. Es re-ejecutable (la segunda pasada no encuentra nada que cambiar).

\set ON_ERROR_STOP on

BEGIN;

-- Las columnas JSONB se reescriben pasando por texto. Es correcto aqui porque
-- el prefijo que se sustituye no puede aparecer en ninguna otra parte del
-- documento (ni en un titulo ni en un mimeType), y evita tener que caminar cada
-- forma de array/objeto por separado.

-- users.photo — TEXT plano.
UPDATE users
   SET photo = replace(photo, :'old_prefix', :'new_prefix')
 WHERE photo LIKE :'old_prefix' || '%';

-- tools_content — un documento y dos arrays de MediaItem.
UPDATE tools_content
   SET downloadables   = replace(downloadables::text,   :'old_prefix', :'new_prefix')::jsonb,
       manual_document = CASE WHEN manual_document IS NULL THEN NULL
                              ELSE replace(manual_document::text, :'old_prefix', :'new_prefix')::jsonb END,
       activity_guides = replace(activity_guides::text, :'old_prefix', :'new_prefix')::jsonb
 WHERE downloadables::text   LIKE '%' || :'old_prefix' || '%'
    OR manual_document::text LIKE '%' || :'old_prefix' || '%'
    OR activity_guides::text LIKE '%' || :'old_prefix' || '%';

-- emotion_content.stories — array de MediaItem.
UPDATE emotion_content
   SET stories = replace(stories::text, :'old_prefix', :'new_prefix')::jsonb
 WHERE stories::text LIKE '%' || :'old_prefix' || '%';

-- topic_subtopics — pdfs / videos / audios.
UPDATE topic_subtopics
   SET pdfs   = replace(pdfs::text,   :'old_prefix', :'new_prefix')::jsonb,
       videos = replace(videos::text, :'old_prefix', :'new_prefix')::jsonb,
       audios = replace(audios::text, :'old_prefix', :'new_prefix')::jsonb
 WHERE pdfs::text   LIKE '%' || :'old_prefix' || '%'
    OR videos::text LIKE '%' || :'old_prefix' || '%'
    OR audios::text LIKE '%' || :'old_prefix' || '%';

-- screen_intro_videos.video — un MediaItem.
UPDATE screen_intro_videos
   SET video = replace(video::text, :'old_prefix', :'new_prefix')::jsonb
 WHERE video::text LIKE '%' || :'old_prefix' || '%';

-- posts.attachments — array de MediaItem.
UPDATE posts
   SET attachments = replace(attachments::text, :'old_prefix', :'new_prefix')::jsonb
 WHERE attachments::text LIKE '%' || :'old_prefix' || '%';

-- Verificacion dentro de la misma transaccion: si algo quedo apuntando al host
-- viejo, aborta y no se confirma nada. Cubre cualquier variante de URL de
-- Supabase (firmada, con otro bucket) que el reemplazo de prefijo no toco.
DO $$
DECLARE
    restantes bigint;
BEGIN
    SELECT count(*) INTO restantes FROM (
        SELECT 1 FROM users               WHERE photo           LIKE '%supabase.co%'
        UNION ALL SELECT 1 FROM tools_content      WHERE downloadables::text   LIKE '%supabase.co%'
                                                      OR manual_document::text LIKE '%supabase.co%'
                                                      OR activity_guides::text LIKE '%supabase.co%'
        UNION ALL SELECT 1 FROM emotion_content    WHERE stories::text     LIKE '%supabase.co%'
        UNION ALL SELECT 1 FROM topic_subtopics    WHERE pdfs::text        LIKE '%supabase.co%'
                                                      OR videos::text      LIKE '%supabase.co%'
                                                      OR audios::text      LIKE '%supabase.co%'
        UNION ALL SELECT 1 FROM screen_intro_videos WHERE video::text      LIKE '%supabase.co%'
        UNION ALL SELECT 1 FROM posts              WHERE attachments::text LIKE '%supabase.co%'
    ) pendientes;

    IF restantes > 0 THEN
        RAISE EXCEPTION 'Quedan % filas apuntando a supabase.co. No se confirma nada; revisa old_prefix.', restantes;
    END IF;
END $$;

COMMIT;

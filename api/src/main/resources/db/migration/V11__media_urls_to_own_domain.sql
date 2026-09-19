-- Las URLs de medios guardadas pasan del sitio .web.app al dominio propio.
--
--   antes:   https://explorarte-6335b.web.app/media/<categoria>/<uuid>-<archivo>
--   despues: https://explorarte.app/media/<categoria>/<uuid>-<archivo>
--
-- POR QUE, porque no es cosmetico: con el host viejo NINGUNA descarga funciona
-- en produccion. La cadena es
--
--   fetch() desde https://explorarte.app
--     -> https://explorarte-6335b.web.app/media/...   (302)
--     -> https://storage.googleapis.com/...?X-Goog-Signature=...
--
-- y el primer salto ya cruza de origen. Cuando un fetch con "response tainting"
-- de tipo cors sigue un redirect hacia un tercer origen, la spec de Fetch obliga
-- a sustituir el origen de la peticion por uno opaco, asi que Cloud Storage
-- recibe `Origin: null`, no lo encuentra en el CORS del bucket y no devuelve
-- Access-Control-Allow-Origin. El navegador bloquea la respuesta y media-cache
-- lo traduce a "No se pudo conectar para descargar el archivo".
--
-- Con el dominio propio el primer salto es del mismo origen, el tainting se
-- queda en "basic", el origen no se marca opaco y Cloud Storage ve
-- `Origin: https://explorarte.app`, que si esta en infra/gcs-media-cors.json.
-- Con curl no se reproduce: alli la cabecera Origin se manda a mano y no hay
-- nadie que la sustituya, asi que responde 200 y parece que todo esta bien.
--
-- LO QUE CUESTA, y hay que decirlo antes de correrlo: cambian TODAS las URLs de
-- medios. Cada archivo que una docente ya tenga descargado queda invalidado
-- -la cache esta indexada por URL- y se vuelve a bajar una vez, la proxima vez
-- que ese telefono tenga red. Para quien tenga varios videos guardados puede ser
-- bastante trafico de golpe. Lo mismo que avisa scripts/migrate-media-urls.sql
-- sobre el corte de Supabase, por la misma razon.
--
-- Fuera de produccion no hace nada: ningun entorno guarda ese prefijo, asi que
-- las siete columnas se quedan como estan. Es re-ejecutable por la misma razon.
--
-- La ruta dentro del bucket no cambia, asi que esto es una sustitucion de
-- prefijo y no un mapeo objeto por objeto. Las columnas JSONB se reescriben
-- pasando por texto: el prefijo no puede aparecer en ninguna otra parte del
-- documento (ni en un titulo ni en un mimeType). Es la misma tecnica y la misma
-- lista de columnas de scripts/migrate-media-urls.sql; si aparece una columna
-- nueva con MediaItem dentro, va en los dos sitios.

-- users.photo — TEXT plano.
UPDATE users
   SET photo = replace(photo,
                       'https://explorarte-6335b.web.app/media/',
                       'https://explorarte.app/media/')
 WHERE photo LIKE 'https://explorarte-6335b.web.app/media/%';

-- tools_content — un documento y dos arrays de MediaItem.
UPDATE tools_content
   SET downloadables   = replace(downloadables::text,
                                 'https://explorarte-6335b.web.app/media/',
                                 'https://explorarte.app/media/')::jsonb,
       manual_document = CASE WHEN manual_document IS NULL THEN NULL
                              ELSE replace(manual_document::text,
                                           'https://explorarte-6335b.web.app/media/',
                                           'https://explorarte.app/media/')::jsonb END,
       activity_guides = replace(activity_guides::text,
                                 'https://explorarte-6335b.web.app/media/',
                                 'https://explorarte.app/media/')::jsonb
 WHERE downloadables::text   LIKE '%https://explorarte-6335b.web.app/media/%'
    OR manual_document::text LIKE '%https://explorarte-6335b.web.app/media/%'
    OR activity_guides::text LIKE '%https://explorarte-6335b.web.app/media/%';

-- emotion_content.stories — array de MediaItem.
UPDATE emotion_content
   SET stories = replace(stories::text,
                         'https://explorarte-6335b.web.app/media/',
                         'https://explorarte.app/media/')::jsonb
 WHERE stories::text LIKE '%https://explorarte-6335b.web.app/media/%';

-- topic_subtopics — pdfs / videos / audios.
UPDATE topic_subtopics
   SET pdfs   = replace(pdfs::text,
                        'https://explorarte-6335b.web.app/media/',
                        'https://explorarte.app/media/')::jsonb,
       videos = replace(videos::text,
                        'https://explorarte-6335b.web.app/media/',
                        'https://explorarte.app/media/')::jsonb,
       audios = replace(audios::text,
                        'https://explorarte-6335b.web.app/media/',
                        'https://explorarte.app/media/')::jsonb
 WHERE pdfs::text   LIKE '%https://explorarte-6335b.web.app/media/%'
    OR videos::text LIKE '%https://explorarte-6335b.web.app/media/%'
    OR audios::text LIKE '%https://explorarte-6335b.web.app/media/%';

-- screen_intro_videos.video — un MediaItem.
UPDATE screen_intro_videos
   SET video = replace(video::text,
                       'https://explorarte-6335b.web.app/media/',
                       'https://explorarte.app/media/')::jsonb
 WHERE video::text LIKE '%https://explorarte-6335b.web.app/media/%';

-- posts.attachments — array de MediaItem.
UPDATE posts
   SET attachments = replace(attachments::text,
                             'https://explorarte-6335b.web.app/media/',
                             'https://explorarte.app/media/')::jsonb
 WHERE attachments::text LIKE '%https://explorarte-6335b.web.app/media/%';

-- Flyway ya envuelve cada migracion en una transaccion, asi que si algo de esto
-- falla no se confirma nada y el arranque se detiene. Lo que si hace falta es
-- que no quede ni una fila con el host viejo: una sola que sobreviva es un
-- archivo que se sigue sin poder descargar, y sin error de red que lo delate.
DO $$
DECLARE
    restantes bigint;
BEGIN
    SELECT count(*) INTO restantes FROM (
        SELECT 1 FROM users                WHERE photo             LIKE '%explorarte-6335b.web.app/media/%'
        UNION ALL SELECT 1 FROM tools_content       WHERE downloadables::text   LIKE '%explorarte-6335b.web.app/media/%'
                                                       OR manual_document::text LIKE '%explorarte-6335b.web.app/media/%'
                                                       OR activity_guides::text LIKE '%explorarte-6335b.web.app/media/%'
        UNION ALL SELECT 1 FROM emotion_content     WHERE stories::text     LIKE '%explorarte-6335b.web.app/media/%'
        UNION ALL SELECT 1 FROM topic_subtopics     WHERE pdfs::text        LIKE '%explorarte-6335b.web.app/media/%'
                                                       OR videos::text      LIKE '%explorarte-6335b.web.app/media/%'
                                                       OR audios::text      LIKE '%explorarte-6335b.web.app/media/%'
        UNION ALL SELECT 1 FROM screen_intro_videos WHERE video::text       LIKE '%explorarte-6335b.web.app/media/%'
        UNION ALL SELECT 1 FROM posts               WHERE attachments::text LIKE '%explorarte-6335b.web.app/media/%'
    ) pendientes;

    IF restantes > 0 THEN
        RAISE EXCEPTION 'Quedan % filas con el host viejo. Falta una columna en esta migracion.', restantes;
    END IF;
END $$;

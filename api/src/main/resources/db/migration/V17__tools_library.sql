-- Caja de herramientas pasa a ser una biblioteca: estantes con libros, y una
-- bibliografía con imagen y enlace.
--
-- Dos columnas nuevas en vez de reescribir las viejas. Un teléfono que todavía
-- corre la PWA anterior hace `bibliography.map(b => <li>{b}</li>)`: si esa
-- columna pasara a traer objetos, React tiraría la pantalla entera. La API
-- sigue devolviendo los cuatro campos viejos, derivados de estos dos, y las
-- columnas viejas se quedan como estaban (nadie las vuelve a escribir).
--
-- Lo que ya había se reparte en tres estantes, en el orden en que se veía:
-- el manual, las guías y los recursos. Cada archivo se vuelve un libro con el
-- id y el título del archivo y sin portada: la portada automática la genera
-- el navegador de una administradora, no Postgres.

ALTER TABLE tools_content
    ADD COLUMN shelves            JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN bibliography_items JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE FUNCTION pg_temp.tool_book(m JSONB) RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object(
        'id', m->>'id',
        'title', COALESCE(NULLIF(m->>'title', ''), 'Documento'),
        'author', NULL,
        'file', m,
        'cover', NULL,
        'autoCover', NULL)
$$;

CREATE FUNCTION pg_temp.tool_books(items JSONB) RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(jsonb_agg(pg_temp.tool_book(e.m) ORDER BY e.ord), '[]'::jsonb)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END)
         WITH ORDINALITY AS e(m, ord)
    WHERE jsonb_typeof(e.m) = 'object' AND COALESCE(e.m->>'url', '') <> ''
$$;

UPDATE tools_content
SET shelves = jsonb_build_array(
        jsonb_build_object('id', 'manual', 'title', 'Manual ExplorArte',
            'books', CASE WHEN jsonb_typeof(manual_document) = 'object'
                          THEN pg_temp.tool_books(jsonb_build_array(manual_document))
                          ELSE '[]'::jsonb END),
        jsonb_build_object('id', 'guias', 'title', 'Guías de actividades',
            'books', pg_temp.tool_books(activity_guides)),
        jsonb_build_object('id', 'recursos', 'title', 'Recursos descargables',
            'books', pg_temp.tool_books(downloadables))),
    -- Las entradas eran "Título — Autor" en una sola cadena: se parten por el
    -- primer " — ". Si no lo hay, todo es título y el autor queda vacío.
    bibliography_items = (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'id', 'bib-' || b.ord,
                   'title', CASE WHEN strpos(b.s, ' — ') > 0
                                 THEN left(b.s, strpos(b.s, ' — ') - 1) ELSE b.s END,
                   'author', CASE WHEN strpos(b.s, ' — ') > 0
                                  THEN NULLIF(substr(b.s, strpos(b.s, ' — ') + 3), '') END,
                   'image', NULL,
                   'url', NULL) ORDER BY b.ord), '[]'::jsonb)
        FROM jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(bibliography) = 'array' THEN bibliography ELSE '[]'::jsonb END)
             WITH ORDINALITY AS b(s, ord)
        WHERE btrim(b.s) <> '');

// Genera V15__learning_content_2026.sql a partir del MISMO seed que sirve el
// mock, para que las dos copias del contenido no puedan divergir a mano.
//
// Se corre una vez y su salida se versiona; no forma parte del build.
import { writeFileSync } from 'node:fs';
import { TOPICS, SCREEN_INTRO_PARAGRAPHS } from '../shared/dist/api/mock/seed.js';

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const jq = (v) => q(JSON.stringify(v)) + '::jsonb';

const LAYOUT_SQL = { accordion: 'ACCORDION', path: 'PATH', slides: 'SLIDES' };

const header = `-- El contenido de "Aprendiendo sobre bienestar emocional", del documento de
-- Sueños y Letras.
--
-- Lo que había en los tres temas era un resumen: un párrafo por subtema, que es
-- todo lo que cabía en la columna \`body\`. El material real trae para cada tema
-- su propia introducción, secciones "¿Por qué es importante?", listas de
-- prácticas, cuadros de "Recuerda" y preguntas para reflexionar.
--
-- Generado desde shared/src/api/mock/seed.ts con scripts/gen-learning-content.mjs
-- para que la copia del mock y esta no puedan divergir a mano. Si hay que
-- corregir una frase, el sitio es el CMS: esta migración ya corrió.
--
-- INSERT ... ON CONFLICT y no UPDATE, porque Flyway corre ANTES que el contexto
-- de Spring: en una base recién creada esta migración llega con topics vacía, y
-- un UPDATE tocaría cero filas. Con el upsert, una base nueva y la de
-- producción acaban en el mismo sitio.

`;

const lines = [header];

// ── temas ───────────────────────────────────────────────────────────────────
lines.push('INSERT INTO topics (id, emoji, title, layout, intro) VALUES');
lines.push(
  TOPICS.map(
    (t) =>
      `    (${q(t.id)}, ${q(t.emoji)}, ${q(t.title)}, ${q(LAYOUT_SQL[t.layout])},\n     ${jq(t.intro)})`,
  ).join(',\n'),
);
lines.push(`ON CONFLICT (id) DO UPDATE
   SET emoji  = EXCLUDED.emoji,
       title  = EXCLUDED.title,
       layout = EXCLUDED.layout,
       intro  = EXCLUDED.intro;
`);

// ── medios ya subidos ───────────────────────────────────────────────────────
lines.push(`-- Los pdfs/videos/audios que una administradora ya subió a una fase NO los
-- escribe esta migración y no se pueden perder: son archivos reales en Cloud
-- Storage cuyo único puntero es esta fila. Se guardan por clave y se vuelven a
-- colgar de la fase que tenga esa misma clave.
CREATE TEMP TABLE medios_previos ON COMMIT DROP AS
SELECT topic_id,
       -- Dos fases de \`aula\` se reorganizaron y con ello cambiaron de clave.
       -- Sin este puente, los archivos que colgaran de ellas quedarían
       -- huérfanos. Las claves viejas se derivan con explorarte_slug() de los
       -- títulos que sembraba DataSeeder, no se escriben a mano: así el
       -- truncado a 48 caracteres es el mismo que aplicó V12.
       CASE subtopic_key
           WHEN explorarte_slug('Qué hacer y qué evitar cuando un estudiante expresa emociones')
                THEN 'que-hacer-cuando-expresa-una-emocion-dificil'
           WHEN explorarte_slug('Recomendaciones para promover espacios seguros y respetuosos')
                THEN 'construyendo-espacios-emocionalmente-seguros'
           ELSE subtopic_key
       END AS subtopic_key,
       pdfs, videos, audios
  FROM topic_subtopics
 WHERE topic_id IN ('autocuidado', 'salud-mental', 'aula');

DELETE FROM topic_subtopics
 WHERE topic_id IN ('autocuidado', 'salud-mental', 'aula');
`);

// ── subtemas ────────────────────────────────────────────────────────────────
const rows = [];
for (const t of TOPICS) {
  t.subtopics.forEach((s, i) => {
    rows.push(
      `        (${q(t.id)}, ${i}, ${q(s.key)}, ${q(s.emoji)}, ${q(s.title)},\n         ${jq(s.blocks)})`,
    );
  });
}

lines.push(`-- Sin id explícito: dejar que la secuencia BIGSERIAL los asigne es lo único
-- que funciona igual en una base vacía y en una donde ya hay subtemas.
INSERT INTO topic_subtopics
    (topic_id, position, subtopic_key, emoji, title, blocks, pdfs, videos, audios)
SELECT v.topic_id, v.position, v.subtopic_key, v.emoji, v.title, v.blocks,
       COALESCE(m.pdfs,   '[]'::jsonb),
       COALESCE(m.videos, '[]'::jsonb),
       COALESCE(m.audios, '[]'::jsonb)
  FROM (VALUES
${rows.join(',\n')}
       ) AS v(topic_id, position, subtopic_key, emoji, title, blocks)
  LEFT JOIN medios_previos m
         ON m.topic_id = v.topic_id AND m.subtopic_key = v.subtopic_key;
`);

// ── párrafos de introducción de pantalla ────────────────────────────────────
const intros = Object.entries(SCREEN_INTRO_PARAGRAPHS);
lines.push(`-- Los párrafos de introducción de la pantalla de aprendizaje. El video sigue
-- vacío: ese archivo no existe todavía y se sube desde el CMS.
--
-- Solo se escriben si la fila no tiene ya texto propio: si alguien se adelantó
-- y los escribió desde el CMS, lo suyo manda.
INSERT INTO screen_intro_videos (screen_key, video, paragraphs) VALUES
${intros.map(([k, v]) => `    (${q(k)}, NULL, ${jq(v)})`).join(',\n')}
ON CONFLICT (screen_key) DO UPDATE
   SET paragraphs = EXCLUDED.paragraphs
 WHERE jsonb_array_length(screen_intro_videos.paragraphs) = 0;
`);

const out = new URL('../api/src/main/resources/db/migration/V15__learning_content_2026.sql', import.meta.url);
writeFileSync(out, lines.join('\n'), 'utf8');
console.log('escrito', out);
console.log('temas:', TOPICS.length, '| subtemas:', rows.length, '| intros:', intros.length);

-- Una pantalla puede tener también párrafos de introducción, y el video pasa a
-- ser opcional: hay pantallas donde el texto es todo lo que hay.
--
-- Ese texto estaba escrito a mano en el JSX de cada pantalla —un párrafo, fijo—
-- así que cambiar una frase exigía un despliegue. Aquí lo edita la
-- administradora, en el mismo sitio donde ya sube el video.
--
-- La TABLA no se renombra a screen_intros, aunque el nombre se quede corto.
-- Renombrarla cuesta: V11 y scripts/migrate-media-urls.sql la nombran, y
-- MigrationChainTest inserta en ella después de aplicar la cadena entera y
-- comprueba sus columnas por nombre. Son cuatro sitios a tocar, uno de ellos un
-- script histórico de un corte que ya ocurrió, a cambio de cero comportamiento.
-- El nombre se corrige donde es gratis: en las etiquetas que la administradora
-- lee en el CMS.
ALTER TABLE screen_intro_videos
    ALTER COLUMN video DROP NOT NULL,
    ADD COLUMN paragraphs JSONB NOT NULL DEFAULT '[]';

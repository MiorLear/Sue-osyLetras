-- La lista de colegios sembrada no correspondia a ninguna escuela real, y el
-- selector desaparecio del alta y del perfil. Todo el programa es una sola
-- institucion, asi que se unifica el valor y se retira la tabla que lo alimentaba.
UPDATE users SET institucion = 'Sueños y Letras';

ALTER TABLE users ALTER COLUMN institucion SET DEFAULT 'Sueños y Letras';

DROP TABLE IF EXISTS schools;

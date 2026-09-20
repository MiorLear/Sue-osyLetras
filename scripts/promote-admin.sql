-- Da el rol ADMIN a una cuenta que ya existe.
--
-- Por qué hace falta un script: no hay ninguna otra forma. El seeder solo crea
-- admin@explorarte.org cuando se le inyecta SEED_USER_PASSWORD, y producción se
-- despliega a propósito sin esa variable (SEC-02) para no quedar con un ADMIN de
-- contraseña conocida — render.yaml llegó a llevar una literal que funcionaba,
-- commiteada en un repo público. Además seedUsers() se salta entero si la tabla
-- ya tiene filas, así que setear la variable ahora no crearía nada. Y la API no
-- expone cambio de rol: AdminUserController solo tiene list, approve, reject,
-- invite y delete. Queda la base.
--
-- Uso:
--   gcloud sql connect explorarte-6335b-instance \
--     --user=postgres --database=explorarte --project explorarte-6335b
--   -- (pide la contraseña; está en Secret Manager como DB_PASSWORD)
--
--   \set email 'persona@ejemplo.com'
--   \i scripts/promote-admin.sql
--
-- O de una sola vez:
--   psql "$CLOUD_SQL_URL" -v email="persona@ejemplo.com" -f scripts/promote-admin.sql
--
-- Es re-ejecutable: promover a quien ya es ADMIN no cambia nada salvo volver a
-- invalidar sus tokens.

\set ON_ERROR_STOP on

BEGIN;

-- El correo pasa por una tabla temporal en vez de ir suelto en cada sentencia:
-- psql no interpola sus variables dentro de un cuerpo entrecomillado con $$, así
-- que la comprobación de más abajo no podría leer :'email' de otra forma.
CREATE TEMP TABLE _objetivo ON COMMIT DROP AS SELECT lower(:'email') AS email;

-- `role` es @Enumerated(EnumType.STRING), así que el valor va en mayúsculas y
-- como texto. token_version sube para que el JWT que esa persona tenga abierto
-- deje de valer: sin eso sigue navegando con el rol viejo hasta que caduque
-- (JWT_EXPIRATION_MINUTES=1440, o sea un día entero).
UPDATE users u
   SET role = 'ADMIN',
       token_version = token_version + 1
  FROM _objetivo t
 WHERE lower(u.email) = t.email;

-- Un correo mal escrito actualiza cero filas y psql no diría nada: saldría un
-- "UPDATE 0" entre el ruido y la persona se quedaría esperando un permiso que
-- nunca se dio. Que aborte.
DO $$
DECLARE
    promovida boolean;
BEGIN
    SELECT EXISTS (SELECT 1
                     FROM users u
                     JOIN _objetivo t ON lower(u.email) = t.email
                    WHERE u.role = 'ADMIN')
      INTO promovida;
    IF NOT promovida THEN
        RAISE EXCEPTION 'Ese correo no existe en users o no quedó como ADMIN. No se confirma nada.';
    END IF;
END $$;

-- Quién tiene las llaves después de esto. Conviene mirarlo: es la lista completa.
SELECT id, email, role, token_version FROM users WHERE role = 'ADMIN' ORDER BY email;

COMMIT;

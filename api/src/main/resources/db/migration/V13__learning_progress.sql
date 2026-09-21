-- Qué fases de qué tema ha completado cada docente.
--
-- Mismo molde que calendar_events: una fila por usuaria, FK a users(id) con
-- ON DELETE CASCADE, y nada que el resto de la app pueda leer sin ser esa
-- usuaria. Es el primer estado por usuaria sobre contenido que tiene el
-- proyecto; hasta ahora solo había `completed` en una tarea de agenda.
--
-- NO hay FK a topic_subtopics, y es deliberado: esa tabla se vacía y se
-- reinserta entera en cada guardado del CMS, así que un ON DELETE CASCADE
-- contra ella borraría el avance de todas las docentes cada vez que alguien
-- corrige una tilde. La FK va contra topics, que sí es estable, y la fase se
-- referencia por su clave. Una fase que la administradora elimina deja una fila
-- huérfana inofensiva —la pantalla la ignora porque cruza con las claves que el
-- tema tiene hoy— y si la vuelve a crear con la misma clave el avance
-- reaparece, que es justo lo que una docente esperaría.
CREATE TABLE learning_progress (
    user_id      VARCHAR(64)  NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    topic_id     VARCHAR(64)  NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    subtopic_key VARCHAR(64)  NOT NULL,
    completed_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, topic_id, subtopic_key)
);

-- La clave primaria ya sirve para (user_id) y (user_id, topic_id), que son las
-- dos únicas lecturas. Lo que la PK NO cubre es el borrado en cascada desde
-- topics: PostgreSQL no indexa la columna que referencia una FK, así que borrar
-- un tema desde el CMS sería un recorrido secuencial de toda la tabla.
CREATE INDEX idx_learning_progress_topic ON learning_progress (topic_id);

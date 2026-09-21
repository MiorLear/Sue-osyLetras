package com.explorarte.api.db;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * V16 — la migración que repara lo que V15 duplicó.
 *
 * <p>V15 escribió su contenido con los ids del seed dando por hecho que eran
 * los de producción. No lo eran: allí los temas los creó una administradora
 * desde el CMS y su id sale del título completo, así que el upsert insertó tres
 * temas nuevos en vez de actualizar los que había y la pantalla pasó a enseñar
 * seis.
 *
 * <p>Una migración de reparación corre <b>una sola vez</b> y sobre datos que no
 * se pueden recuperar, así que aquí se reconstruye el estado exacto de
 * producción —los tres temas del CMS, con sus ids y sus claves truncadas— y se
 * comprueba contra él. Los dos casos que importan son el que arregla y el que
 * NO debe tocar.
 */
class TopicMergeMigrationTest {

    private static EmbeddedPostgres postgres;
    private static DataSource dataSource;

    @BeforeAll
    static void startPostgres() throws IOException {
        postgres = EmbeddedPostgres.start();
        dataSource = postgres.getPostgresDatabase();
    }

    @AfterAll
    static void stopPostgres() throws IOException {
        if (postgres != null) postgres.close();
    }

    private Flyway flywayUpTo(String target) {
        var config = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .cleanDisabled(false);
        if (target != null) config = config.target(target);
        return config.load();
    }

    /**
     * El escenario de producción: los tres temas del CMS ya existen cuando
     * llega V15, y V15 crea los suyos al lado.
     */
    @Test
    void mergesTheDuplicatesBackIntoTheTopicsTheCmsHadCreated() throws SQLException {
        Flyway hastaV14 = flywayUpTo("14");
        hastaV14.clean();
        hastaV14.migrate();

        // Los tres del CMS, con el id que sale de slugificar el título entero.
        execute("""
                INSERT INTO topics (id, emoji, title, layout, intro) VALUES
                    ('practicar-autocuidado', '🧘', 'Practicar autocuidado', 'ACCORDION', '[]'),
                    ('por-que-importa-la-salud-mental-en-la-infancia', '🧠',
                     '¿Por qué importa la salud mental en la infancia?', 'ACCORDION', '[]'),
                    ('como-acompanar-emociones-dificiles-en-el-aula', '🏫',
                     'Cómo acompañar emociones difíciles en el aula', 'ACCORDION', '[]');

                INSERT INTO topic_subtopics (topic_id, position, subtopic_key, emoji, title, body, blocks)
                VALUES
                    ('practicar-autocuidado', 0, 'introduccion', '', 'Introducción', '',
                     '[{"kind":"paragraph","text":"Texto viejo, aplanado por V12."}]'),
                    ('practicar-autocuidado', 1, 'cuidando-mis-emociones', '', '🌸 Cuidando mis emociones', '',
                     '[{"kind":"paragraph","text":"Todo en parrafos sueltos."}]');

                INSERT INTO users (id, name, lastname, email, password_hash, role, status)
                VALUES ('u-docente', 'Ana', 'P', 'ana@ejemplo.com', 'x', 'TEACHER', 'APPROVED');
                """);

        // Y una docente que ya marcó una fase en el tema que V15 va a crear.
        // Se inserta después de V15 porque antes el tema no existe todavía.
        flywayUpTo(null).migrate();

        assertThat(scalar("SELECT count(*) FROM topics WHERE id IN ('autocuidado','salud-mental','aula')"))
                .as("los duplicados de V15 desaparecen")
                .isEqualTo("0");
        assertThat(scalar("SELECT count(*) FROM topics")).as("quedan los tres reales").isEqualTo("3");

        // El id del CMS sobrevive, y hereda la forma y el contenido bueno.
        assertThat(scalar("SELECT layout FROM topics WHERE id = 'practicar-autocuidado'")).isEqualTo("PATH");
        assertThat(scalar("SELECT jsonb_array_length(intro) FROM topics WHERE id = 'practicar-autocuidado'"))
                .as("la introducción del tema deja de ser un subtema")
                .isEqualTo("3");
        assertThat(scalar("SELECT layout FROM topics WHERE id = 'como-acompanar-emociones-dificiles-en-el-aula'"))
                .isEqualTo("SLIDES");

        // Los subtemas son los de V15, no los aplanados: el emoji está en su
        // campo y no metido en el título, y los bloques tienen tipos de verdad.
        assertThat(scalar("""
                SELECT count(*) FROM topic_subtopics
                 WHERE topic_id = 'practicar-autocuidado'
                """)).isEqualTo("3");
        assertThat(scalar("""
                SELECT emoji FROM topic_subtopics
                 WHERE topic_id = 'practicar-autocuidado' AND subtopic_key = 'cuidando-mis-emociones'
                """)).isEqualTo("🌸");
        assertThat(scalar("""
                SELECT title FROM topic_subtopics
                 WHERE topic_id = 'practicar-autocuidado' AND subtopic_key = 'cuidando-mis-emociones'
                """)).isEqualTo("Cuidando mis emociones");
        assertThat(scalar("""
                SELECT count(*) FROM topic_subtopics s
                 WHERE s.topic_id = 'practicar-autocuidado'
                   AND s.blocks @> '[{"kind":"checklist"}]'
                """)).as("el contenido bueno trae listas, no solo párrafos").isNotEqualTo("0");

        // Y no queda ningún subtema colgando de un tema que ya no existe.
        assertThat(scalar("""
                SELECT count(*) FROM topic_subtopics s
                 WHERE NOT EXISTS (SELECT 1 FROM topics t WHERE t.id = s.topic_id)
                """)).isEqualTo("0");
    }

    /** El avance de una docente se muda al id que sobrevive. */
    @Test
    void movesSavedProgressOntoTheSurvivingTopic() throws SQLException {
        Flyway hastaV15 = flywayUpTo("15");
        hastaV15.clean();
        hastaV15.migrate();

        execute("""
                INSERT INTO topics (id, emoji, title, layout, intro)
                VALUES ('practicar-autocuidado', '🧘', 'Practicar autocuidado', 'ACCORDION', '[]');

                INSERT INTO users (id, name, lastname, email, password_hash, role, status)
                VALUES ('u-docente', 'Ana', 'P', 'ana@ejemplo.com', 'x', 'TEACHER', 'APPROVED');

                INSERT INTO learning_progress (user_id, topic_id, subtopic_key)
                VALUES ('u-docente', 'autocuidado', 'cuidando-mi-cuerpo');
                """);

        flywayUpTo(null).migrate();

        assertThat(scalar("""
                SELECT topic_id FROM learning_progress WHERE user_id = 'u-docente'
                """)).isEqualTo("practicar-autocuidado");
        assertThat(scalar("""
                SELECT subtopic_key FROM learning_progress WHERE user_id = 'u-docente'
                """)).isEqualTo("cuidando-mi-cuerpo");
    }

    /**
     * Y en una base nueva no hace nada.
     *
     * <p>Es el caso de local y de CI: los temas del CMS no existen, V15 ya deja
     * los suyos bien puestos y V16 no tiene nada que fusionar. Si tocara algo
     * aquí, se llevaría por delante el contenido recién sembrado.
     */
    @Test
    void leavesACleanDatabaseAlone() throws SQLException {
        Flyway todo = flywayUpTo(null);
        todo.clean();
        todo.migrate();

        assertThat(scalar("SELECT count(*) FROM topics")).isEqualTo("3");
        assertThat(scalar("SELECT layout FROM topics WHERE id = 'autocuidado'")).isEqualTo("PATH");
        assertThat(scalar("SELECT count(*) FROM topic_subtopics WHERE topic_id = 'autocuidado'"))
                .isEqualTo("3");
    }

    // --- helpers -----------------------------------------------------------

    private void execute(String sql) throws SQLException {
        try (Connection c = dataSource.getConnection(); Statement s = c.createStatement()) {
            s.execute(sql);
        }
    }

    private String scalar(String sql) throws SQLException {
        try (Connection c = dataSource.getConnection();
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery(sql)) {
            assertThat(rs.next()).as("la consulta devolvió una fila: %s", sql).isTrue();
            return rs.getString(1);
        }
    }
}

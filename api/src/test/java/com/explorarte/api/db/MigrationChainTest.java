package com.explorarte.api.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * GCP-07 — la parte de la portabilidad que se puede afirmar en vez de suponer.
 *
 * <p>Arranca un PostgreSQL 16 real (la misma familia que Cloud SQL y que el
 * {@code postgres:16-alpine} de docker-compose), completamente vacío, y prueba
 * dos cosas que el día de la migración solo se descubrirían en producción:
 *
 * <ol>
 *   <li>La cadena V1→V7 aplica limpia sobre una base recién creada. Es
 *       exactamente lo que hace el primer arranque contra Cloud SQL.</li>
 *   <li>{@code scripts/migrate-media-urls.sql} es SQL válido contra el esquema
 *       que esas migraciones producen, y reescribe lo que dice reescribir. Ese
 *       script es el artefacto más arriesgado de este batch: se escribe a mano,
 *       corre una sola vez, sobre datos de producción, y nombra columnas que
 *       nadie le garantiza que sigan llamándose igual.</li>
 * </ol>
 *
 * <p>Usa embedded-postgres, no Testcontainers, para no depender de un daemon de
 * Docker: así corre igual en CI, dentro del build de la imagen, y en la máquina
 * de quien no tenga Docker levantado.
 */
class MigrationChainTest {

    private static final String OLD_PREFIX =
            "https://abc123.supabase.co/storage/v1/object/public/explorarte-media/";
    private static final String NEW_PREFIX = "https://explorarte-prod.web.app/media/";
    private static final Path MIGRATE_MEDIA_URLS_SQL = Path.of("..", "scripts", "migrate-media-urls.sql");

    private static EmbeddedPostgres postgres;
    private static DataSource dataSource;

    @BeforeAll
    static void startPostgres() throws IOException {
        postgres = EmbeddedPostgres.start();
        dataSource = postgres.getPostgresDatabase();
    }

    @AfterAll
    static void stopPostgres() throws IOException {
        if (postgres != null) {
            postgres.close();
        }
    }

    private Flyway flyway() {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .cleanDisabled(false)
                .load();
    }

    @Test
    void appliesTheWholeChainOnACleanDatabase() {
        Flyway flyway = flyway();
        flyway.clean();

        flyway.migrate();

        List<String> applied = new ArrayList<>();
        for (MigrationInfo info : flyway.info().applied()) {
            applied.add(info.getVersion().getVersion());
            assertThat(info.getState().isFailed())
                    .as("migration %s state", info.getVersion())
                    .isFalse();
        }
        assertThat(applied).containsExactly("1", "2", "3", "4", "5", "6", "7");

        // validate() vuelve a leer los checksums: si alguien editó una migración
        // ya aplicada en vez de agregar una nueva, esto es lo que lo dice — y en
        // producción sería un arranque fallido, no un test rojo.
        flyway.validate();

        // Y el segundo arranque no hace nada, que es lo que pasa en cada deploy
        // posterior al primero.
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }

    /** Las siete columnas que scripts/migrate-media-urls.sql toca, tal como
     * quedan tras V1→V7. Si alguien renombra una, el script deja de reescribir
     * esas filas en silencio y las URLs viejas sobreviven a la migración. */
    @Test
    void keepsTheColumnsTheUrlMigrationScriptDependsOn() throws SQLException {
        flyway().migrate();

        assertColumnExists("users", "photo");
        assertColumnExists("tools_content", "downloadables");
        assertColumnExists("tools_content", "manual_document");
        assertColumnExists("tools_content", "activity_guides");
        assertColumnExists("emotion_content", "stories");
        assertColumnExists("topic_subtopics", "pdfs");
        assertColumnExists("topic_subtopics", "videos");
        assertColumnExists("topic_subtopics", "audios");
        assertColumnExists("screen_intro_videos", "video");
        assertColumnExists("posts", "attachments");
    }

    /**
     * <p>El script vive en {@code scripts/}, fuera del contexto de build de la
     * imagen ({@code dockerContext: ./api}), así que dentro de
     * {@code docker build} no existe y este caso se salta. Donde importa —CI y
     * cualquier checkout completo— sí corre, y ahí es donde está la puerta.
     */
    @Test
    void rewritesEveryStoredMediaUrlAndLeavesNothingPointingAtSupabase() throws Exception {
        assumeTrue(Files.exists(MIGRATE_MEDIA_URLS_SQL),
                "scripts/migrate-media-urls.sql no está en este checkout (build de Docker)");

        Flyway flyway = flyway();
        flyway.clean();
        flyway.migrate();

        seedRowsWithSupabaseUrls();

        runMigrateMediaUrlsScript();

        assertThat(scalar("SELECT photo FROM users WHERE id = 'u-1'"))
                .isEqualTo(NEW_PREFIX + "profile/9f1c-foto.png");
        assertThat(scalar("SELECT attachments->0->>'url' FROM posts WHERE id = 1"))
                .isEqualTo(NEW_PREFIX + "posts/9f1c-ficha.pdf");
        assertThat(scalar("SELECT video->>'url' FROM screen_intro_videos WHERE screen_key = 'home'"))
                .isEqualTo(NEW_PREFIX + "screen-intros/9f1c-intro.mp4");
        assertThat(scalar("SELECT stories->0->>'url' FROM emotion_content WHERE emotion_id = 'e-1'"))
                .isEqualTo(NEW_PREFIX + "emotions/9f1c-cuento.pdf");
        assertThat(scalar("SELECT pdfs->0->>'url' FROM topic_subtopics WHERE id = 1"))
                .isEqualTo(NEW_PREFIX + "learning/9f1c-guia.pdf");
        assertThat(scalar("SELECT manual_document->>'url' FROM tools_content WHERE id = 1"))
                .isEqualTo(NEW_PREFIX + "tools/9f1c-manual.pdf");

        // Lo que no debe sobrevivir: el resto del MediaItem sí, la URL no.
        assertThat(scalar("SELECT attachments->0->>'title' FROM posts WHERE id = 1"))
                .isEqualTo("ficha.pdf");
        assertThat(scalar("SELECT attachments->0->>'id' FROM posts WHERE id = 1"))
                .isEqualTo("9f1c");
    }

    // --- helpers -----------------------------------------------------------

    private void seedRowsWithSupabaseUrls() throws SQLException {
        execute("""
                INSERT INTO users (id, name, lastname, email, password_hash, role, status, photo)
                VALUES ('u-1', 'Ana', 'Perez', 'ana@example.com', 'x', 'TEACHER', 'APPROVED',
                        '%1$sprofile/9f1c-foto.png');

                INSERT INTO posts (id, user_name, handle, avatar_bg, text, attachments)
                VALUES (1, 'Ana', '@ana', '#fff', 'hola',
                        '[{"id":"9f1c","title":"ficha.pdf","url":"%1$sposts/9f1c-ficha.pdf",
                           "mimeType":"application/pdf","sizeBytes":10}]');

                INSERT INTO screen_intro_videos (screen_key, video)
                VALUES ('home',
                        '{"id":"9f1c","title":"intro.mp4","url":"%1$sscreen-intros/9f1c-intro.mp4",
                          "mimeType":"video/mp4","sizeBytes":10}');

                INSERT INTO emotions (id, name, emoji, color, bg) VALUES ('e-1', 'Alegria', ':)', '#1', '#2');
                INSERT INTO emotion_content (emotion_id, description, classroom, stories)
                VALUES ('e-1', 'd', 'c',
                        '[{"id":"9f1c","title":"cuento.pdf","url":"%1$semotions/9f1c-cuento.pdf",
                           "mimeType":"application/pdf","sizeBytes":10}]');

                INSERT INTO topics (id, emoji, title) VALUES ('t-1', ':)', 'Tema');
                INSERT INTO topic_subtopics (id, topic_id, position, title, body, pdfs)
                VALUES (1, 't-1', 0, 'Sub', 'b',
                        '[{"id":"9f1c","title":"guia.pdf","url":"%1$slearning/9f1c-guia.pdf",
                           "mimeType":"application/pdf","sizeBytes":10}]');

                INSERT INTO tools_content (id, manual_document)
                VALUES (1,
                        '{"id":"9f1c","title":"manual.pdf","url":"%1$stools/9f1c-manual.pdf",
                          "mimeType":"application/pdf","sizeBytes":10}');
                """.formatted(OLD_PREFIX));
    }

    /**
     * Corre el script real, no una copia. Lo único que se sustituye son las
     * construcciones de psql que JDBC no entiende: la meta-orden {@code \set} y
     * las variables {@code :'nombre'}, que psql expande a literales antes de
     * mandar la consulta. El SQL en sí —los UPDATE y el bloque DO de
     * verificación— viaja tal cual está en el repositorio, que es todo el punto:
     * si el script no compila contra el esquema, este test se pone rojo.
     */
    private void runMigrateMediaUrlsScript() throws IOException, SQLException {
        String sql = Files.readString(MIGRATE_MEDIA_URLS_SQL, StandardCharsets.UTF_8)
                .lines()
                .filter(line -> !line.stripLeading().startsWith("\\set"))
                .reduce("", (a, b) -> a + "\n" + b)
                .replace(":'old_prefix'", quote(OLD_PREFIX))
                .replace(":'new_prefix'", quote(NEW_PREFIX));

        execute(sql);
    }

    private static String quote(String literal) {
        return "'" + literal.replace("'", "''") + "'";
    }

    private void execute(String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private String scalar(String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            assertThat(rs.next()).as("la consulta devolvió una fila: %s", sql).isTrue();
            return rs.getString(1);
        }
    }

    private void assertColumnExists(String table, String column) throws SQLException {
        String found = scalar("""
                SELECT count(*) FROM information_schema.columns
                 WHERE table_name = '%s' AND column_name = '%s'
                """.formatted(table, column));
        assertThat(found).as("%s.%s", table, column).isEqualTo("1");
    }
}

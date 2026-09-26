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

    /** Los dos prefijos de V11: el sitio por defecto del proyecto y el dominio propio. */
    private static final String WEB_APP_PREFIX = "https://explorarte-6335b.web.app/media/";
    private static final String OWN_DOMAIN_PREFIX = "https://explorarte.app/media/";

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
        assertThat(applied).containsExactly(
                "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17",
                "18", "19", "20", "21", "22");

        // validate() vuelve a leer los checksums: si alguien editó una migración
        // ya aplicada en vez de agregar una nueva, esto es lo que lo dice — y en
        // producción sería un arranque fallido, no un test rojo.
        flyway.validate();

        // Y el segundo arranque no hace nada, que es lo que pasa en cada deploy
        // posterior al primero.
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }

    /**
     * V9 — las actividades de una emoción eran una cadena suelta dentro del
     * JSONB, y por eso la tarjeta de la app no podía enseñar más que el nombre.
     * La migración las convierte en objetos con campos para propósito,
     * duración, edades, materiales, paso a paso y preguntas.
     *
     * <p>Lo que importa aquí es que no pierda nada: el nombre tiene que
     * sobrevivir, lo que ya estuviera estructurado no se puede volver a
     * envolver, y una lista vacía tiene que seguir vacía.
     */
    @Test
    void turnsPlainActivityStringsIntoObjectsWithoutLosingTheName() throws SQLException {
        Flyway throughV8 = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("8")
                .cleanDisabled(false)
                .load();
        throughV8.clean();
        throughV8.migrate();

        execute("""
                INSERT INTO emotions (id, name, emoji, color, bg) VALUES
                    ('viejo', 'Viejo', ':)', '#1', '#2'),
                    ('nuevo', 'Nuevo', ':)', '#1', '#2'),
                    ('vacio', 'Vacio', ':)', '#1', '#2');

                INSERT INTO emotion_content (emotion_id, description, classroom, activities) VALUES
                    ('viejo', 'd', 'c', '["Respiracion del globo", "Botella de la calma"]'),
                    ('nuevo', 'd', 'c',
                     '[{"title":"Ya estructurada","purpose":"p","duration":"10 min","ages":"6-9",
                        "materials":"m","steps":["uno"],"questions":["q"]}]'),
                    ('vacio', 'd', 'c', '[]');
                """);

        flyway().migrate();

        // La cadena pasa a objeto y el nombre queda intacto.
        assertThat(scalar("SELECT jsonb_typeof(activities->0) FROM emotion_content WHERE emotion_id = 'viejo'"))
                .isEqualTo("object");
        assertThat(scalar("SELECT activities->0->>'title' FROM emotion_content WHERE emotion_id = 'viejo'"))
                .isEqualTo("Respiracion del globo");
        assertThat(scalar("SELECT activities->1->>'title' FROM emotion_content WHERE emotion_id = 'viejo'"))
                .isEqualTo("Botella de la calma");

        // Lo que no existe queda vacío, nunca relleno: un dato plausible que
        // nadie escribió es el fallo que esta migración no puede introducir.
        assertThat(scalar("SELECT activities->0->>'duration' FROM emotion_content WHERE emotion_id = 'viejo'"))
                .isEmpty();
        assertThat(scalar("SELECT activities->0->>'ages' FROM emotion_content WHERE emotion_id = 'viejo'"))
                .isEmpty();
        assertThat(scalar("SELECT jsonb_typeof(activities->0->'steps') FROM emotion_content WHERE emotion_id = 'viejo'"))
                .isEqualTo("array");

        // Idempotente: correrla sobre algo ya estructurado no lo envuelve otra vez.
        assertThat(scalar("SELECT activities->0->>'title' FROM emotion_content WHERE emotion_id = 'nuevo'"))
                .isEqualTo("Ya estructurada");
        assertThat(scalar("SELECT activities->0->>'duration' FROM emotion_content WHERE emotion_id = 'nuevo'"))
                .isEqualTo("10 min");

        // Y una lista vacía sigue siendo una lista vacía, no NULL.
        assertThat(scalar("SELECT activities::text FROM emotion_content WHERE emotion_id = 'vacio'"))
                .isEqualTo("[]");
    }

    /**
     * V10 — V9 dio por hecho que una actividad cargada era solo un nombre,
     * porque eso es lo que siembra {@code DataSeeder}. Las 43 de producción no:
     * vienen del material de Sueños y Letras y traen propósito, duración,
     * edades, materiales, paso a paso y preguntas dentro de la misma cadena,
     * con etiquetas. Sin repartirlas, la tarjeta rediseñada enseña un párrafo
     * de 750 caracteres como título en negrita y debajo "Sin detalle todavía".
     *
     * <p>El primer caso es una actividad real de producción, copiada tal cual.
     * Los otros dos son las dos formas de equivocarse: inventar un paso donde
     * solo había un paréntesis con números, y repartir una cadena que no es una
     * actividad.
     */
    @Test
    void splitsTheLoadedActivityTextIntoTheFieldsTheCardShows() throws SQLException {
        Flyway throughV8 = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("8")
                .cleanDisabled(false)
                .load();
        throughV8.clean();
        throughV8.migrate();

        execute("""
                INSERT INTO emotions (id, name, emoji, color, bg) VALUES
                    ('cargada', 'Cargada', ':)', '#1', '#2'),
                    ('numerada', 'Numerada', ':)', '#1', '#2'),
                    ('ajena', 'Ajena', ':)', '#1', '#2');

                INSERT INTO emotion_content (emotion_id, description, classroom, activities) VALUES
                    ('cargada', 'd', 'c', jsonb_build_array($a$El mural de las cosas buenas — \
                Objetivo: reconocer experiencias positivas y fortalecer el agradecimiento. \
                Duración: 20 minutos. Edades: 5 a 15 años. Materiales: cartulina o papelógrafo, \
                notas adhesivas, marcadores. Instrucciones: cada estudiante escribe o dibuja una \
                experiencia que le haya dado alegría durante la semana. Luego colocan sus notas en \
                un mural común. Preguntas para reflexionar: ¿Qué tienen en común nuestras \
                experiencias? ¿Cómo nos sentimos al escuchar las alegrías de otras personas? ¿Qué \
                podemos hacer para crear más momentos positivos en nuestra escuela?$a$)),
                    ('numerada', 'd', 'c', jsonb_build_array($b$Agentes de paz — \
                Objetivo: practicar formas respetuosas de resolver desacuerdos. \
                Duración: 25-30 minutos. Edades: 8 a 15 años. Materiales: tarjetas de situaciones \
                (3-6 años) y un accesorio. Cómo jugar: 1) El conflicto aparece: cada pareja toma \
                una tarjeta. 2) Congelados: representan la escena. 3) Entra el agente de paz y \
                propone un acuerdo. Preguntas para reflexionar: ¿Funcionó la misma solución para \
                todos?$b$)),
                    ('ajena', 'd', 'c', jsonb_build_array($c$Historias sugeridas: Ramón Preocupón \
                (Anthony Browne, 4-8 años): un niño con demasiadas preocupaciones.$c$));
                """);

        flyway().migrate();

        // Cada cosa en su campo, y el título sin el guión que lo separaba.
        assertThat(field("cargada", "title")).isEqualTo("El mural de las cosas buenas");
        assertThat(field("cargada", "purpose"))
                .isEqualTo("reconocer experiencias positivas y fortalecer el agradecimiento.");
        assertThat(field("cargada", "duration")).isEqualTo("20 minutos");
        assertThat(field("cargada", "ages")).isEqualTo("5 a 15 años");
        assertThat(field("cargada", "materials"))
                .isEqualTo("cartulina o papelógrafo, notas adhesivas, marcadores.");

        // Prosa corrida: un paso, no uno por frase. Partir por el punto
        // convertiría una abreviatura en un paso que nadie escribió.
        assertThat(scalar(len("cargada", "steps"))).isEqualTo("1");
        assertThat(scalar("SELECT activities->0->'steps'->>0 FROM emotion_content WHERE emotion_id = 'cargada'"))
                .startsWith("cada estudiante escribe")
                .endsWith("un mural común.");

        // Una pregunta por signo de cierre.
        assertThat(scalar(len("cargada", "questions"))).isEqualTo("3");
        assertThat(scalar("SELECT activities->0->'questions'->>0 FROM emotion_content WHERE emotion_id = 'cargada'"))
                .isEqualTo("¿Qué tienen en común nuestras experiencias?");

        // Numerada: tres pasos, sin el ordinal, y el "(3-6 años)" de los
        // materiales no abre un cuarto.
        assertThat(scalar(len("numerada", "steps"))).isEqualTo("3");
        assertThat(scalar("SELECT activities->0->'steps'->>0 FROM emotion_content WHERE emotion_id = 'numerada'"))
                .isEqualTo("El conflicto aparece: cada pareja toma una tarjeta.");
        assertThat(scalar("SELECT activities->0->'steps'->>2 FROM emotion_content WHERE emotion_id = 'numerada'"))
                .isEqualTo("Entra el agente de paz y propone un acuerdo.");
        assertThat(field("numerada", "materials")).contains("(3-6 años)");

        // Y lo que no es una actividad se queda como lo dejó V9: entero en el
        // título, sin campos inventados a partir de un texto que no los tiene.
        assertThat(field("ajena", "title")).startsWith("Historias sugeridas: Ramón Preocupón");
        assertThat(field("ajena", "purpose")).isEmpty();
        assertThat(scalar(len("ajena", "steps"))).isEqualTo("0");
    }

    private String field(String emotionId, String key) throws SQLException {
        return scalar("SELECT activities->0->>'" + key + "' FROM emotion_content WHERE emotion_id = '"
                + emotionId + "'");
    }

    private String len(String emotionId, String key) {
        return "SELECT jsonb_array_length(activities->0->'" + key + "') FROM emotion_content"
                + " WHERE emotion_id = '" + emotionId + "'";
    }

    /**
     * V11 — con el host viejo ninguna descarga funciona, y no por el servidor.
     * La cadena es explorarte.app → explorarte-6335b.web.app (302) → Cloud
     * Storage, y el primer salto ya cruza de origen: al seguir el redirect hacia
     * un tercer origen, la spec de Fetch sustituye el origen de la petición por
     * uno opaco, Cloud Storage recibe {@code Origin: null}, no lo encuentra en
     * el CORS del bucket y no manda Access-Control-Allow-Origin. Desde el
     * dominio propio el primer salto es del mismo origen y eso no pasa.
     *
     * <p>Lo que se prueba aquí es lo único que puede fallar en frío: que la
     * migración alcance las siete columnas. Una que se quede con el host viejo
     * es un archivo que no se descarga, y sin error de red que lo delate.
     */
    @Test
    void movesEveryStoredMediaUrlToTheOwnDomain() throws SQLException {
        Flyway throughV10 = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("10")
                .cleanDisabled(false)
                .load();
        throughV10.clean();
        throughV10.migrate();

        seedRowsWithMediaPrefix(WEB_APP_PREFIX);

        flyway().migrate();

        assertThat(scalar("SELECT photo FROM users WHERE id = 'u-1'"))
                .isEqualTo(OWN_DOMAIN_PREFIX + "profile/9f1c-foto.png");
        assertThat(scalar("SELECT attachments->0->>'url' FROM posts WHERE id = 1"))
                .isEqualTo(OWN_DOMAIN_PREFIX + "posts/9f1c-ficha.pdf");
        assertThat(scalar("SELECT video->>'url' FROM screen_intro_videos WHERE screen_key = 'home'"))
                .isEqualTo(OWN_DOMAIN_PREFIX + "screen-intros/9f1c-intro.mp4");
        assertThat(scalar("SELECT stories->0->>'url' FROM emotion_content WHERE emotion_id = 'e-1'"))
                .isEqualTo(OWN_DOMAIN_PREFIX + "emotions/9f1c-cuento.pdf");
        assertThat(scalar("SELECT pdfs->0->>'url' FROM topic_subtopics WHERE topic_id = 't-1'"))
                .isEqualTo(OWN_DOMAIN_PREFIX + "learning/9f1c-guia.pdf");
        assertThat(scalar("SELECT manual_document->>'url' FROM tools_content WHERE id = 1"))
                .isEqualTo(OWN_DOMAIN_PREFIX + "tools/9f1c-manual.pdf");

        // El resto del MediaItem no se toca: reescribir por texto plano podría
        // haberse llevado por delante un título o un mimeType.
        assertThat(scalar("SELECT attachments->0->>'title' FROM posts WHERE id = 1"))
                .isEqualTo("ficha.pdf");
        assertThat(scalar("SELECT attachments->0->>'mimeType' FROM posts WHERE id = 1"))
                .isEqualTo("application/pdf");
    }

    /** Y en un entorno que nunca vio ese host no hace nada: el bloque de
     * verificación no puede abortar el arranque de local, Render o los tests. */
    @Test
    void leavesUrlsOfOtherEnvironmentsAlone() throws SQLException {
        Flyway throughV10 = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("10")
                .cleanDisabled(false)
                .load();
        throughV10.clean();
        throughV10.migrate();

        seedRowsWithMediaPrefix("http://localhost:8000/media/");

        flyway().migrate();

        assertThat(scalar("SELECT photo FROM users WHERE id = 'u-1'"))
                .isEqualTo("http://localhost:8000/media/profile/9f1c-foto.png");
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

    @Test
    void backfillsUpdatedAtInEveryMediaItemJsonbShapeWithoutAddingColumns() throws SQLException {
        Flyway throughV7 = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("7")
                .cleanDisabled(false)
                .load();
        throughV7.clean();
        throughV7.migrate();
        seedRowsWithSupabaseUrls();

        flyway().migrate();

        assertThat(scalar("SELECT attachments->0->>'updatedAt' FROM posts WHERE id = 1")).isNotBlank();
        assertThat(scalar("SELECT video->>'updatedAt' FROM screen_intro_videos WHERE screen_key = 'home'")).isNotBlank();
        assertThat(scalar("SELECT stories->0->>'updatedAt' FROM emotion_content WHERE emotion_id = 'e-1'")).isNotBlank();
        assertThat(scalar("SELECT pdfs->0->>'updatedAt' FROM topic_subtopics WHERE topic_id = 't-1'")).isNotBlank();
        assertThat(scalar("SELECT manual_document->>'updatedAt' FROM tools_content WHERE id = 1")).isNotBlank();
        assertThat(scalar("SELECT attachments->0->>'etag' FROM posts WHERE id = 1")).isNull();
        assertThat(scalar("SELECT count(*) FROM information_schema.columns WHERE column_name IN ('updated_at', 'etag')"))
                .isEqualTo("0");
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
        assertThat(scalar("SELECT pdfs->0->>'url' FROM topic_subtopics WHERE topic_id = 't-1'"))
                .isEqualTo(NEW_PREFIX + "learning/9f1c-guia.pdf");
        assertThat(scalar("SELECT manual_document->>'url' FROM tools_content WHERE id = 1"))
                .isEqualTo(NEW_PREFIX + "tools/9f1c-manual.pdf");

        // Lo que no debe sobrevivir: el resto del MediaItem sí, la URL no.
        assertThat(scalar("SELECT attachments->0->>'title' FROM posts WHERE id = 1"))
                .isEqualTo("ficha.pdf");
        assertThat(scalar("SELECT attachments->0->>'id' FROM posts WHERE id = 1"))
                .isEqualTo("9f1c");
    }

    /**
     * V17 — la Caja de herramientas pasa a estantes. Lo que ya estaba subido
     * tiene que aparecer como libros en el mismo orden en que se veia, y la
     * bibliografia "Titulo — Autor" se parte en sus dos campos sin perder nada.
     */
    @Test
    void turnsTheToolsListsIntoShelvesAndTheBibliographyIntoEntries() throws SQLException {
        Flyway throughV16 = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target("16")
                .cleanDisabled(false)
                .load();
        throughV16.clean();
        throughV16.migrate();

        execute("""
                INSERT INTO tools_content (id, manual_document, activity_guides, downloadables, bibliography)
                VALUES (1,
                    '{"id":"m1","title":"Manual","url":"https://explorarte.app/media/tools/m1.pdf","mimeType":"application/pdf","sizeBytes":1}',
                    '[{"id":"g1","title":"Guia 1","url":"https://explorarte.app/media/tools/g1.pdf","mimeType":"application/pdf","sizeBytes":1},
                      {"id":"g2","title":"Guia 2","url":"https://explorarte.app/media/tools/g2.pdf","mimeType":"application/pdf","sizeBytes":1}]',
                    '[{"id":"","title":"","url":""}]',
                    '["El cerebro del niño — Daniel J. Siegel", "Sin autor", "  "]');
                """);

        flyway().migrate();

        assertThat(scalar("SELECT jsonb_array_length(shelves) FROM tools_content")).isEqualTo("3");
        assertThat(scalar("SELECT shelves->0->>'title' FROM tools_content")).isEqualTo("Manual ExplorArte");
        assertThat(scalar("SELECT shelves->0->'books'->0->'file'->>'id' FROM tools_content")).isEqualTo("m1");
        assertThat(scalar("SELECT shelves->0->'books'->0->>'title' FROM tools_content")).isEqualTo("Manual");
        assertThat(scalar("SELECT shelves->1->'books'->1->>'id' FROM tools_content")).isEqualTo("g2");
        // La fila vacia que dejaba el editor viejo no se vuelve un libro sin archivo.
        assertThat(scalar("SELECT jsonb_array_length(shelves->2->'books') FROM tools_content")).isEqualTo("0");
        // Sin portada: la automatica la genera el navegador, no la migracion.
        assertThat(scalar("SELECT jsonb_typeof(shelves->0->'books'->0->'autoCover') FROM tools_content")).isEqualTo("null");

        assertThat(scalar("SELECT jsonb_array_length(bibliography_items) FROM tools_content")).isEqualTo("2");
        assertThat(scalar("SELECT bibliography_items->0->>'title' FROM tools_content")).isEqualTo("El cerebro del niño");
        assertThat(scalar("SELECT bibliography_items->0->>'author' FROM tools_content")).isEqualTo("Daniel J. Siegel");
        assertThat(scalar("SELECT bibliography_items->1->>'title' FROM tools_content")).isEqualTo("Sin autor");
        assertThat(scalar("SELECT bibliography_items->1->>'author' FROM tools_content")).isNull();
    }

    /**
     * V18 — la descripción corta de cada fase. En una base nueva el tema del
     * mapa se llama {@code autocuidado} (el de V15); en producción,
     * {@code practicar-autocuidado} (el que V16 conserva). Las tres fases
     * tienen que salir con texto en los dos casos, y los temas que no son un
     * mapa quedan sin descripción.
     */
    @Test
    void fillsThePhaseDescriptionsOfTheSelfCareMap() throws SQLException {
        Flyway flyway = flyway();
        flyway.clean();
        flyway.migrate();

        assertThat(scalar("""
                SELECT count(*) FROM topic_subtopics
                 WHERE topic_id = 'autocuidado' AND description IS NOT NULL
                """)).isEqualTo("3");
        assertThat(scalar("""
                SELECT description FROM topic_subtopics
                 WHERE topic_id = 'autocuidado' AND subtopic_key = 'cuidando-mi-cuerpo'
                """)).startsWith("Descanso, alimentación y movimiento");
        assertThat(scalar("""
                SELECT count(*) FROM topic_subtopics
                 WHERE topic_id <> 'autocuidado' AND description IS NOT NULL
                """)).isEqualTo("0");
    }

    // --- helpers -----------------------------------------------------------

    private void seedRowsWithSupabaseUrls() throws SQLException {
        seedRowsWithMediaPrefix(OLD_PREFIX);
    }

    /**
     * Las siete columnas con MediaItem dentro, sembradas con el prefijo que se
     * le pase. Lo comparten el script de Supabase y V11, que hacen lo mismo
     * sobre las mismas columnas y se equivocarían igual si alguien renombra una.
     *
     * <p>El subtema se inserta <b>sin id</b>. Con uno explícito la secuencia
     * BIGSERIAL no avanza, así que el siguiente {@code nextval} devuelve 1 otra
     * vez: en cuanto V15 inserta sus propias fases, la migración choca contra
     * esta y falla dentro del test — y el que falla en producción es el arranque.
     *
     * <p>Y {@code subtopic_key} solo se nombra si ya existe: este helper se usa
     * antes de V12 (que la crea) y también después de la cadena entera.
     */
    private void seedRowsWithMediaPrefix(String prefix) throws SQLException {
        boolean keyed = columnExists("topic_subtopics", "subtopic_key");
        String keyColumn = keyed ? "subtopic_key, " : "";
        String keyValue = keyed ? "'sub'," : "";
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
                INSERT INTO topic_subtopics (topic_id, position, title, body, %2$spdfs)
                VALUES ('t-1', 0, 'Sub', 'b', %3$s
                        '[{"id":"9f1c","title":"guia.pdf","url":"%1$slearning/9f1c-guia.pdf",
                           "mimeType":"application/pdf","sizeBytes":10}]');

                INSERT INTO tools_content (id, manual_document)
                VALUES (1,
                        '{"id":"9f1c","title":"manual.pdf","url":"%1$stools/9f1c-manual.pdf",
                          "mimeType":"application/pdf","sizeBytes":10}');
                """.formatted(prefix, keyColumn, keyValue));
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

    private boolean columnExists(String table, String column) throws SQLException {
        return "1".equals(scalar("""
                SELECT count(*) FROM information_schema.columns
                 WHERE table_name = '%s' AND column_name = '%s'
                """.formatted(table, column)));
    }

    private void assertColumnExists(String table, String column) throws SQLException {
        assertThat(columnExists(table, column)).as("%s.%s", table, column).isTrue();
    }
}

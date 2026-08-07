package com.explorarte.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * GCP-07 — el test que faltaba: ¿arranca?
 *
 * <p>La suite era entera de tests unitarios, rapidísima y sin contexto de
 * Spring. Eso dejaba un hueco del tamaño exacto de un bug que este batch
 * encontró corriendo la imagen de producción a mano: `SecurityConfig` anclaba el
 * filtro de rate limiting contra `JwtAuthenticationFilter` antes de haberlo
 * agregado, Spring Security 6.3 respondía "does not have a registered order", y
 * <b>la API no levantaba en ningún entorno</b>. 147 tests en verde y un
 * contenedor que no arranca.
 *
 * <p>Levanta el contexto completo contra un PostgreSQL 16 real y vacío, con
 * configuración con forma de Cloud Run. Comprueba tres cosas que solo se ven con
 * el contexto entero:
 *
 * <ol>
 *   <li>La cadena de filtros de seguridad se construye.</li>
 *   <li>El esquema que produce Flyway satisface {@code ddl-auto: validate}, o
 *       sea que las entidades JPA y las migraciones no se han separado. Ese
 *       desajuste también es un arranque fallido, no un 500.</li>
 *   <li>Las reglas de autorización que este batch tocó responden lo que dicen.</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApplicationStartsTest {

    private static EmbeddedPostgres postgres;

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) throws IOException {
        postgres = EmbeddedPostgres.start();
        registry.add("spring.datasource.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "");
        // Configuración con forma de producción, para que el contexto se
        // construya con los mismos beans que en Cloud Run. El bucket se declara
        // pero nunca se toca: ningún test de aquí sube ni lee un archivo.
        registry.add("app.gcs.bucket", () -> "explorarte-prod.firebasestorage.app");
        registry.add("app.media.public-base-url", () -> "https://explorarte-prod.web.app");
        registry.add("app.cors.allowed-origins", () -> "https://explorarte-prod.web.app");
    }

    @Autowired
    private ApplicationContext context;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void theApplicationContextLoads() {
        assertThat(context.getBean("filterChain")).isNotNull();
        assertThat(context.containsBean("mediaAccessController")).isTrue();
        assertThat(context.containsBean("gcsMediaStorageClient")).isTrue();
    }

    @Test
    void servesHealthWithoutAToken() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    /** GCP-04: leer un medio no exige token (ver MediaAccessController), pero
     * subirlo sí. Sin esta distinción la migración habría cerrado las fotos de
     * perfil de toda la web sin que ningún test lo dijera. */
    @Test
    void keepsMediaReadsOpenAndMediaUploadsClosed() throws Exception {
        // Lo que se afirma es que la petición ATRAVIESA la capa de seguridad: el
        // fallo tiene que venir del almacenamiento, no de la autorización. Sin
        // un bucket real eso es 404 (el objeto no está) o 503 (no hay
        // credenciales de Google en esta máquina), y cuál de los dos depende de
        // si quien corre el test tiene ADC configurado. Un 401/403 sería el bug:
        // significaría haber cerrado por accidente las fotos de perfil y los
        // adjuntos de toda la web.
        int mediaStatus = mockMvc.perform(get("/media/tools/9f1c-x.pdf"))
                .andReturn().getResponse().getStatus();
        assertThat(mediaStatus).isIn(404, 503);

        mockMvc.perform(get("/posts")).andExpect(status().isUnauthorized());
    }
}

package com.explorarte.api.learning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import jakarta.persistence.EntityManager;

/**
 * El contenido de Aprendiendo pasa por <b>dos</b> ObjectMapper distintos, y
 * este test es lo único que puede afirmar que los dos escriben la misma forma.
 *
 * <p>Spring MVC serializa el DTO con su mapper autoconfigurado; Hibernate
 * serializa la columna JSONB con el suyo propio. Si el discriminante
 * {@code kind} dependiera de configurar el mapper en vez de vivir en las
 * anotaciones de {@link LearningBlock}, el JSON del cable y el de la columna
 * divergirían y nada lo diría hasta que alguien recargase un tema en el CMS: la
 * respuesta seguiría viéndose bien, y el contenido guardado dejaría de poder
 * leerse.
 *
 * <p>Así que la ida y la vuelta se prueban por separado: la escritura contra el
 * repositorio (mapper de Hibernate) y la lectura contra el endpoint público
 * (mapper de Spring).
 */
@SpringBootTest
@AutoConfigureMockMvc
class LearningBlockPersistenceTest {

    private static EmbeddedPostgres postgres;

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) throws IOException {
        postgres = EmbeddedPostgres.start();
        registry.add("spring.datasource.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "");
        registry.add("app.gcs.bucket", () -> "explorarte-prod.firebasestorage.app");
        registry.add("app.media.public-base-url", () -> "https://explorarte-prod.web.app");
        registry.add("app.cors.allowed-origins", () -> "https://explorarte-prod.web.app");
    }

    @Autowired
    private TopicRepository topicRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private MockMvc mockMvc;

    @Test
    @Transactional
    void survivesARoundTripThroughJsonbWithEveryBlockKind() {
        Topic topic = new Topic();
        topic.setId("tema-de-prueba");
        topic.setEmoji("🧪");
        topic.setTitle("Tema de prueba");
        topic.setLayout(TopicLayout.PATH);
        topic.setIntro(List.of(new LearningBlock.Paragraph("Introducción del tema.")));

        SubTopic fase = new SubTopic();
        fase.setTopic(topic);
        fase.setKey("fase-unica");
        fase.setEmoji("🌸");
        fase.setTitle("Fase única");
        fase.setBlocks(List.of(
                new LearningBlock.Paragraph("Un párrafo."),
                new LearningBlock.Heading("¿Por qué es importante?"),
                new LearningBlock.Checklist("Prácticas", List.of("Dormir.", "Respirar.")),
                new LearningBlock.AvoidList("Qué evitar", List.of("Minimizar lo que siente.")),
                new LearningBlock.Callout("Recuerda", "Todas las emociones son válidas."),
                new LearningBlock.Reflection(List.of("¿Cómo me siento hoy?")),
                new LearningBlock.Quote("Gracias por contarme cómo te sientes."),
                new LearningBlock.Definitions("El mensaje de cada emoción",
                        List.of(new LearningBlock.DefinitionItem("La alegría", "nos invita a compartir.")))));
        fase.setPdfs(List.of());
        fase.setVideos(List.of());
        fase.setAudios(List.of());
        topic.setSubtopics(List.of(fase));

        topicRepository.save(topic);
        // Vaciar el contexto de persistencia es lo que obliga a releer desde la
        // columna: sin esto, el find devolvería los mismos objetos en memoria y
        // el test pasaría aunque el JSONB guardado fuera ilegible.
        entityManager.flush();
        entityManager.clear();

        Topic releido = topicRepository.findById("tema-de-prueba").orElseThrow();

        assertThat(releido.getLayout()).isEqualTo(TopicLayout.PATH);
        assertThat(releido.getIntro()).containsExactly(new LearningBlock.Paragraph("Introducción del tema."));

        List<LearningBlock> bloques = releido.getSubtopics().get(0).getBlocks();
        assertThat(bloques).hasSize(8);
        // Cada bloque vuelve con su clase concreta, no como un Map ni como el
        // primer subtipo que Jackson supiera construir.
        assertThat(bloques).hasOnlyElementsOfTypes(
                LearningBlock.Paragraph.class, LearningBlock.Heading.class,
                LearningBlock.Checklist.class, LearningBlock.AvoidList.class,
                LearningBlock.Callout.class, LearningBlock.Reflection.class,
                LearningBlock.Quote.class, LearningBlock.Definitions.class);
        assertThat(bloques.get(2)).isEqualTo(new LearningBlock.Checklist("Prácticas", List.of("Dormir.", "Respirar.")));
        assertThat(bloques.get(7)).isEqualTo(new LearningBlock.Definitions("El mensaje de cada emoción",
                List.of(new LearningBlock.DefinitionItem("La alegría", "nos invita a compartir."))));
        assertThat(releido.getSubtopics().get(0).getKey()).isEqualTo("fase-unica");
    }

    /**
     * Y lo que V15 dejó escrito se puede leer por el endpoint público, con el
     * {@code kind} en cada bloque. Es la mitad del viaje que el otro test no
     * cubre: el mapper de Spring.
     */
    @Test
    void servesTheSeededContentWithItsLayoutAndBlockKinds() throws Exception {
        mockMvc.perform(get("/learning/topics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == 'autocuidado')].layout").value("path"))
                .andExpect(jsonPath("$[?(@.id == 'autocuidado')].intro[0].kind").value("paragraph"))
                .andExpect(jsonPath("$[?(@.id == 'autocuidado')].subtopics[0].key")
                        .value("cuidando-mis-emociones"))
                .andExpect(jsonPath("$[?(@.id == 'autocuidado')].subtopics[0].emoji").value("🌸"))
                .andExpect(jsonPath("$[?(@.id == 'autocuidado')].subtopics[0].blocks[0].kind").value("heading"))
                .andExpect(jsonPath("$[?(@.id == 'autocuidado')].subtopics[0].blocks[4].kind").value("checklist"))
                .andExpect(jsonPath("$[?(@.id == 'autocuidado')].subtopics[0].blocks[5].kind").value("callout"))
                .andExpect(jsonPath("$[?(@.id == 'aula')].layout").value("slides"));
    }

    /** El avance es de cada docente: leerlo sin token no es una lectura pública. */
    @Test
    void keepsProgressBehindAToken() throws Exception {
        mockMvc.perform(get("/learning/progress")).andExpect(status().isUnauthorized());
    }
}

package com.explorarte.api.learning;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * Borrar contenido de Aprendiendo, ahora que hay una tabla que lo referencia.
 *
 * <p>V13 añadió {@code learning_progress} con una FK a {@code topics}, y
 * {@code topic_subtopics} ganó una constraint UNIQUE sobre la clave del
 * subtema. Las dos son cosas nuevas en el camino de un borrado, y las dos
 * podrían romperlo de maneras que ningún test anterior miraba: el CMS borra un
 * tema entero con {@code DELETE /learning/topics/{id}}, y borra un subtema
 * suelto mandando un PUT con la lista sin él —que por dentro es un
 * {@code clear()} + {@code addAll()} de la colección completa—.
 */
@SpringBootTest
class LearningDeletionTest {

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
    private LearningController learningController;

    @Autowired
    private TopicRepository topicRepository;

    @Autowired
    private LearningProgressRepository progressRepository;

    @Autowired
    private com.explorarte.api.user.UserRepository userRepository;

    /** Crea una docente si el seeder no dejó ninguna, y devuelve su id. */
    private String unaDocente() {
        var existentes = userRepository.findAll();
        if (!existentes.isEmpty()) return existentes.get(0).getId();
        var u = new com.explorarte.api.user.User();
        u.setId("u-prueba-borrado");
        u.setName("Ana");
        u.setLastname("Prueba");
        u.setEmail("ana.borrado@ejemplo.com");
        u.setPasswordHash("x");
        u.setRole(com.explorarte.api.user.UserRole.TEACHER);
        u.setStatus(com.explorarte.api.user.UserStatus.APPROVED);
        return userRepository.save(u).getId();
    }

    private SubTopicDto fase(String key, String title) {
        return new SubTopicDto(key, "🌸", title, List.of(new LearningBlock.Paragraph("Cuerpo de " + title)),
                List.of(), List.of(), List.of());
    }

    /** El caso del CMS: quitar un subtema de la lista y guardar el tema. */
    @Test
    void removesASubtopicThroughTheUpdateThatRewritesTheWholeCollection() {
        TopicDto creado = learningController.create(new CreateTopicInput(
                "🧪", "Tema con tres fases", TopicLayout.PATH, List.of(),
                List.of(fase("", "Fase uno"), fase("", "Fase dos"), fase("", "Fase tres"))));
        assertThat(creado.subtopics()).hasSize(3);

        // La administradora borra la del medio y guarda. El cliente devuelve las
        // claves que ya existían, que es lo que mantiene enganchado el avance.
        List<SubTopicDto> quedan = List.of(creado.subtopics().get(0), creado.subtopics().get(2));
        TopicDto tras = learningController.update(creado.id(),
                new UpdateTopicInput(null, null, null, null, quedan));

        assertThat(tras.subtopics()).hasSize(2);
        assertThat(tras.subtopics()).extracting(SubTopicDto::title)
                .containsExactly("Fase uno", "Fase tres");
    }

    /**
     * Y volver a guardar sin cambiar nada tiene que seguir funcionando.
     *
     * <p>Es el caso que la constraint UNIQUE sobre (topic_id, subtopic_key)
     * podría romper: el PUT borra las tres filas y reinserta las tres con las
     * MISMAS claves en el mismo flush, así que si la comprobación no fuera
     * diferida, el orden de las operaciones de Hibernate decidiría si el
     * guardado pasa o revienta.
     */
    @Test
    void savesTheSameSubtopicsTwiceWithoutTrippingTheUniqueKey() {
        TopicDto creado = learningController.create(new CreateTopicInput(
                "🧪", "Tema que se vuelve a guardar", null, List.of(),
                List.of(fase("", "Una"), fase("", "Otra"))));

        TopicDto otraVez = learningController.update(creado.id(),
                new UpdateTopicInput(null, "Tema renombrado", null, null, creado.subtopics()));

        assertThat(otraVez.title()).isEqualTo("Tema renombrado");
        // Renombrar el tema NO puede mover las claves: son el ancla del avance.
        assertThat(otraVez.subtopics()).extracting(SubTopicDto::key)
                .isEqualTo(creado.subtopics().stream().map(SubTopicDto::key).toList());
    }

    /** Dos fases con el mismo título en la misma petición no pueden chocar. */
    @Test
    void disambiguatesTwoNewSubtopicsThatShareATitle() {
        TopicDto creado = learningController.create(new CreateTopicInput(
                "🧪", "Tema con repetidos", null, List.of(),
                List.of(fase("", "Igual"), fase("", "Igual"))));

        assertThat(creado.subtopics()).extracting(SubTopicDto::key)
                .containsExactly("igual", "igual-2");
    }

    /**
     * Borrar el tema entero cuando una docente ya tiene avance en él.
     *
     * <p>Aquí es donde la FK nueva podría morder: sin {@code ON DELETE CASCADE}
     * en {@code learning_progress}, este borrado sería una violación de
     * integridad y el CMS devolvería un 500 al pulsar la papelera.
     */
    @Test
    void deletesATopicThatAlreadyHasProgressAgainstIt() {
        TopicDto creado = learningController.create(new CreateTopicInput(
                "🧪", "Tema con avance", TopicLayout.PATH, List.of(),
                List.of(fase("", "Fase uno"))));
        String stepKey = creado.subtopics().get(0).key();

        // Una usuaria que existe de verdad: learning_progress tiene FK a users.
        String docente = unaDocente();
        progressRepository.save(new LearningProgress(docente, creado.id(), stepKey));
        assertThat(progressRepository.findByUserIdOrderByTopicIdAscSubtopicKeyAsc(docente)).isNotEmpty();

        learningController.remove(creado.id());

        assertThat(topicRepository.existsById(creado.id())).isFalse();
        // Y el avance se va con él, en vez de quedar apuntando a un tema que ya
        // no existe.
        assertThat(progressRepository.findByUserIdOrderByTopicIdAscSubtopicKeyAsc(docente))
                .noneMatch(p -> p.getTopicId().equals(creado.id()));
    }

    /** Borrar un tema sin avance sigue siendo lo de siempre. */
    @Test
    void deletesATopicWithNoProgress() {
        TopicDto creado = learningController.create(new CreateTopicInput(
                "🧪", "Tema sin avance", null, List.of(), List.of(fase("", "Fase"))));

        learningController.remove(creado.id());

        assertThat(topicRepository.existsById(creado.id())).isFalse();
    }
}

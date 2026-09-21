package com.explorarte.api.learning;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
public class LearningController {

    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");
    /** Lo mismo que trunca {@code explorarte_slug()} en V12. */
    private static final int MAX_KEY_LENGTH = 48;

    private final TopicRepository topicRepository;

    public LearningController(TopicRepository topicRepository) {
        this.topicRepository = topicRepository;
    }

    @GetMapping("/learning/topics")
    public List<TopicDto> list() {
        return topicRepository.findAll().stream().map(Topic::toDto).toList();
    }

    @PostMapping("/learning/topics")
    @ResponseStatus(HttpStatus.CREATED)
    public TopicDto create(@Valid @RequestBody CreateTopicInput input) {
        Topic topic = new Topic();
        topic.setId(uniqueSlug(input.title()));
        topic.setEmoji(input.emoji());
        topic.setTitle(input.title());
        topic.setLayout(input.layout() == null ? TopicLayout.ACCORDION : input.layout());
        topic.setIntro(orEmpty(input.intro()));
        topic.setSubtopics(toSubTopics(input.subtopics(), topic));
        topicRepository.save(topic);
        return topic.toDto();
    }

    @PutMapping("/learning/topics/{id}")
    public TopicDto update(@PathVariable String id, @Valid @RequestBody UpdateTopicInput input) {
        Topic topic = topicRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Topic not found: " + id));
        if (input.emoji() != null) topic.setEmoji(input.emoji());
        if (input.title() != null) topic.setTitle(input.title());
        if (input.layout() != null) topic.setLayout(input.layout());
        if (input.intro() != null) topic.setIntro(input.intro());
        if (input.subtopics() != null) {
            topic.getSubtopics().clear();
            topic.getSubtopics().addAll(toSubTopics(input.subtopics(), topic));
        }
        topicRepository.save(topic);
        return topic.toDto();
    }

    @DeleteMapping("/learning/topics/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable String id) {
        topicRepository.deleteById(id);
    }

    private List<SubTopic> toSubTopics(List<SubTopicDto> dtos, Topic topic) {
        if (dtos == null) return List.of();
        // Las claves que ya vienen puestas se reservan ANTES de generar ninguna,
        // para que una clave nueva no pueda pisar la de un subtema existente y
        // llevarse por delante el avance que apunta a ella.
        Set<String> taken = new HashSet<>();
        for (SubTopicDto dto : dtos) {
            if (dto.key() != null && !dto.key().isBlank()) taken.add(dto.key());
        }

        List<SubTopic> result = new ArrayList<>(dtos.size());
        for (SubTopicDto dto : dtos) {
            SubTopic st = new SubTopic();
            st.setTopic(topic);
            // Una clave ya asignada NUNCA se recalcula: es el ancla del avance
            // de cada docente, y regenerarla al renombrar el subtema lo
            // desconectaría sin que nadie lo notara.
            st.setKey(dto.key() != null && !dto.key().isBlank()
                    ? dto.key()
                    : uniqueSubtopicKey(dto.title(), taken));
            st.setEmoji(dto.emoji() == null ? "" : dto.emoji());
            st.setTitle(dto.title());
            // Las columnas son NOT NULL con DEFAULT, y un DEFAULT solo actúa
            // cuando el INSERT no nombra la columna — Hibernate siempre la
            // nombra. Un `"blocks": null` del cliente sería un 409 con un
            // mensaje que no dice nada.
            st.setBlocks(orEmpty(dto.blocks()));
            st.setPdfs(orEmpty(dto.pdfs()));
            st.setVideos(orEmpty(dto.videos()));
            st.setAudios(orEmpty(dto.audios()));
            result.add(st);
        }
        return result;
    }

    private static <T> List<T> orEmpty(List<T> value) {
        return Objects.requireNonNullElseGet(value, List::of);
    }

    /** Desambigua dentro de la propia petición: dos fases nuevas con el mismo título. */
    private String uniqueSubtopicKey(String title, Set<String> taken) {
        String base = slugify(title, MAX_KEY_LENGTH, "paso");
        String candidate = base;
        int suffix = 2;
        while (taken.contains(candidate)) {
            candidate = base + "-" + suffix++;
        }
        taken.add(candidate);
        return candidate;
    }

    private String uniqueSlug(String title) {
        String base = slugify(title, Integer.MAX_VALUE, "topic");
        String candidate = base;
        int suffix = 2;
        while (topicRepository.existsById(candidate)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }

    /** Espejo de {@code explorarte_slug()} (V12). Si cambia una, cambia la otra. */
    private String slugify(String title, int maxLength, String fallback) {
        String normalized = Normalizer.normalize(title == null ? "" : title, Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                .toLowerCase();
        String slug = NON_ALNUM.matcher(normalized).replaceAll("-").replaceAll("^-+|-+$", "");
        if (slug.length() > maxLength) {
            slug = slug.substring(0, maxLength).replaceAll("-+$", "");
        }
        return slug.isBlank() ? fallback : slug;
    }
}

package com.explorarte.api.learning;

import java.text.Normalizer;
import java.util.List;
import java.util.NoSuchElementException;
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

@RestController
public class LearningController {

    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");

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
    public TopicDto create(@RequestBody CreateTopicInput input) {
        Topic topic = new Topic();
        topic.setId(uniqueSlug(input.title()));
        topic.setEmoji(input.emoji());
        topic.setTitle(input.title());
        topic.setSubtopics(toSubTopics(input.subtopics(), topic));
        topicRepository.save(topic);
        return topic.toDto();
    }

    @PutMapping("/learning/topics/{id}")
    public TopicDto update(@PathVariable String id, @RequestBody UpdateTopicInput input) {
        Topic topic = topicRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Topic not found: " + id));
        if (input.emoji() != null) topic.setEmoji(input.emoji());
        if (input.title() != null) topic.setTitle(input.title());
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
        return dtos.stream().map(dto -> {
            SubTopic st = new SubTopic();
            st.setTopic(topic);
            st.setTitle(dto.title());
            st.setBody(dto.body());
            st.setPdfs(dto.pdfs());
            st.setVideos(dto.videos());
            st.setAudios(dto.audios());
            return st;
        }).toList();
    }

    private String uniqueSlug(String title) {
        String base = slugify(title);
        String candidate = base;
        int suffix = 2;
        while (topicRepository.existsById(candidate)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }

    private String slugify(String title) {
        String normalized = Normalizer.normalize(title == null ? "" : title, Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                .toLowerCase();
        String slug = NON_ALNUM.matcher(normalized).replaceAll("-").replaceAll("^-+|-+$", "");
        return slug.isBlank() ? "topic" : slug;
    }
}

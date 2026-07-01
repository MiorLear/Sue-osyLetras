package com.explorarte.api.emotions;

import java.util.List;
import java.util.NoSuchElementException;

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
public class EmotionController {

    private final EmotionRepository emotionRepository;
    private final EmotionContentRepository emotionContentRepository;

    public EmotionController(EmotionRepository emotionRepository, EmotionContentRepository emotionContentRepository) {
        this.emotionRepository = emotionRepository;
        this.emotionContentRepository = emotionContentRepository;
    }

    @GetMapping("/emotions")
    public List<EmotionDto> list() {
        return emotionRepository.findAll().stream().map(Emotion::toDto).toList();
    }

    @GetMapping("/emotions/{id}")
    public EmotionDetailDto get(@PathVariable String id) {
        Emotion emotion = emotionRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Emotion not found: " + id));
        EmotionContent content = emotionContentRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Emotion content not found: " + id));
        return toDetail(emotion, content);
    }

    @PostMapping("/emotions")
    @ResponseStatus(HttpStatus.CREATED)
    public EmotionDetailDto create(@RequestBody EmotionDetailInput input) {
        Emotion emotion = new Emotion();
        emotion.setId(input.id());
        emotion.setName(input.name());
        emotion.setEmoji(input.emoji());
        emotion.setColor(input.color());
        emotion.setBg(input.bg());
        emotionRepository.save(emotion);

        EmotionContent content = new EmotionContent();
        content.setEmotionId(input.id());
        applyContent(content, input.content());
        emotionContentRepository.save(content);

        return toDetail(emotion, content);
    }

    @PutMapping("/emotions/{id}")
    public EmotionDetailDto update(@PathVariable String id, @RequestBody EmotionDetailInput input) {
        Emotion emotion = emotionRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Emotion not found: " + id));
        if (input.name() != null) emotion.setName(input.name());
        if (input.emoji() != null) emotion.setEmoji(input.emoji());
        if (input.color() != null) emotion.setColor(input.color());
        if (input.bg() != null) emotion.setBg(input.bg());
        emotionRepository.save(emotion);

        EmotionContent content = emotionContentRepository.findById(id).orElseGet(() -> {
            EmotionContent c = new EmotionContent();
            c.setEmotionId(id);
            return c;
        });
        if (input.content() != null) applyContent(content, input.content());
        emotionContentRepository.save(content);

        return toDetail(emotion, content);
    }

    @DeleteMapping("/emotions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable String id) {
        emotionContentRepository.deleteById(id);
        emotionRepository.deleteById(id);
    }

    private void applyContent(EmotionContent content, EmotionContentDto dto) {
        if (dto == null) return;
        content.setDescription(dto.description());
        content.setClassroom(dto.classroom());
        content.setQuestions(dto.questions());
        content.setActivities(dto.activities());
        content.setStories(dto.stories());
    }

    private EmotionDetailDto toDetail(Emotion emotion, EmotionContent content) {
        return new EmotionDetailDto(
                emotion.getId(), emotion.getName(), emotion.getEmoji(), emotion.getColor(), emotion.getBg(),
                content.toDto());
    }
}

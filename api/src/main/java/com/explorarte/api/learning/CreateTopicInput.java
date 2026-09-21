package com.explorarte.api.learning;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTopicInput(
        @Size(max = 16) String emoji,
        @NotBlank @Size(max = 200) String title,
        /** Nulo = acordeon, que es como el CMS crea un tema nuevo. */
        TopicLayout layout,
        @Valid @Size(max = 200) List<LearningBlock> intro,
        @Valid @Size(max = 100) List<SubTopicDto> subtopics
) {}

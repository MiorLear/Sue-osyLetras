package com.explorarte.api.learning;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/** Todo opcional: nulo significa "no lo toques", no "dejalo vacio". */
public record UpdateTopicInput(
        @Size(max = 16) String emoji,
        @Size(max = 200) String title,
        TopicLayout layout,
        @Valid @Size(max = 200) List<LearningBlock> intro,
        @Valid @Size(max = 100) List<SubTopicDto> subtopics
) {}

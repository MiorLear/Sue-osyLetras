package com.explorarte.api.learning;

import java.util.List;

public record TopicDto(String id, String emoji, String title, List<SubTopicDto> subtopics) {}

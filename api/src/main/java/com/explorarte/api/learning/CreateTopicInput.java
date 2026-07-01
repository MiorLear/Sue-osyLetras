package com.explorarte.api.learning;

import java.util.List;

public record CreateTopicInput(String emoji, String title, List<SubTopicDto> subtopics) {}

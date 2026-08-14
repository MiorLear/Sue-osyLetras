package com.explorarte.api.learning;

import java.util.List;

public record UpdateTopicInput(String emoji, String title, List<SubTopicDto> subtopics) {}

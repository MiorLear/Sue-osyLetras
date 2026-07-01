package com.explorarte.api.emotions;

import java.util.List;

public record EmotionContentDto(
        String description,
        String classroom,
        List<String> questions,
        List<String> activities,
        List<String> stories
) {}

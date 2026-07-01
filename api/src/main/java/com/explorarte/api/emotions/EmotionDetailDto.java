package com.explorarte.api.emotions;

public record EmotionDetailDto(
        String id,
        String name,
        String emoji,
        String color,
        String bg,
        EmotionContentDto content
) {}

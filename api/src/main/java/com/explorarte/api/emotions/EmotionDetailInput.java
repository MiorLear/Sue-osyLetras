package com.explorarte.api.emotions;

public record EmotionDetailInput(
        String id,
        String name,
        String emoji,
        String color,
        String bg,
        EmotionContentDto content
) {}

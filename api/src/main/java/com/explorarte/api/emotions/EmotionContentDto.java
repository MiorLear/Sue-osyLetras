package com.explorarte.api.emotions;

import java.util.List;

import com.explorarte.api.media.MediaItem;

public record EmotionContentDto(
        String description,
        String classroom,
        List<String> questions,
        List<EmotionActivity> activities,
        List<MediaItem> stories
) {}

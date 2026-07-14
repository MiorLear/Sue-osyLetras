package com.explorarte.api.learning;

import java.util.List;

import com.explorarte.api.media.MediaItem;

public record SubTopicDto(
        String title,
        String body,
        List<MediaItem> pdfs,
        List<MediaItem> videos,
        List<MediaItem> audios
) {}

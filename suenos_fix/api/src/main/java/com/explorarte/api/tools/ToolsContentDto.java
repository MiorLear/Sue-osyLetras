package com.explorarte.api.tools;

import java.util.List;

import com.explorarte.api.media.MediaItem;

public record ToolsContentDto(
        List<MediaItem> downloadables,
        List<String> bibliography,
        MediaItem manualDocument,
        List<MediaItem> activityGuides
) {}

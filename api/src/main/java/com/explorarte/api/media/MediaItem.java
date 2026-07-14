package com.explorarte.api.media;

/** Shared shape for every uploaded photo/video/document, stored as a JSONB
 * value everywhere a piece of content references a file — mirrors
 * shared/src/types/index.ts's MediaItem. */
public record MediaItem(String id, String title, String url, String mimeType, long sizeBytes) {}

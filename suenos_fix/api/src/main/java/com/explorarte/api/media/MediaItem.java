package com.explorarte.api.media;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Shared shape for every uploaded photo/video/document, stored as a JSONB
 * value everywhere a piece of content references a file — mirrors
 * shared/src/types/index.ts's MediaItem.
 *
 * <p>The constraints apply when this record arrives as (part of) a request
 * body under {@code @Valid}; on the response side they are inert. Scheme and
 * host of {@code url} are enforced separately by {@link MediaUrlPolicy}, which
 * needs configuration a bean-validation annotation cannot reach. */
public record MediaItem(
        @NotBlank @Size(max = 64) String id,
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 2048) String url,
        @NotBlank @Size(max = 128) String mimeType,
        @PositiveOrZero long sizeBytes) {}

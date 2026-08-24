package com.explorarte.api.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

class MediaItemJsonContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void omitsAbsentOptionalVersionFieldsFromSerializedResponses() throws Exception {
        MediaItem item = new MediaItem(
                "media-1", "photo.png", "/media/photo.png", "image/png", 42);

        JsonNode json = objectMapper.valueToTree(item);

        assertThat(json.has("updatedAt")).isFalse();
        assertThat(json.has("etag")).isFalse();
    }

    @Test
    void includesPresentOptionalVersionFieldsInSerializedResponses() throws Exception {
        Instant updatedAt = Instant.parse("2026-08-23T12:34:56Z");
        MediaItem item = new MediaItem(
                "media-1", "photo.png", "/media/photo.png", "image/png", 42,
                updatedAt, "etag-1");

        JsonNode json = objectMapper.valueToTree(item);

        assertThat(json.hasNonNull("updatedAt")).isTrue();
        assertThat(json.path("etag").asText()).isEqualTo("etag-1");
    }
}

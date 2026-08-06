package com.explorarte.api.community;

import java.util.List;

import com.explorarte.api.media.MediaItem;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Caps mirror the columns in V1__init_schema.sql: {@code posts.module} is
 * VARCHAR(64); {@code text} is TEXT, capped here at a length a teacher would
 * plausibly write rather than at the database's limit. */
public record CreatePostInput(
        @NotBlank @Size(max = 5000) String text,
        @Size(max = 64) String module,
        @Valid @Size(max = 10, message = "a post accepts at most 10 attachments") List<MediaItem> attachments) {}

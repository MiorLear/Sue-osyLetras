package com.explorarte.api.tools;

import com.explorarte.api.media.MediaItem;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Un libro del estante: un archivo con título, y portada propia o automática
 * (la primera página del PDF, que genera el navegador de una administradora). */
public record ToolBook(
        @NotBlank @Size(max = 64) String id,
        @NotBlank @Size(max = 255) String title,
        @Size(max = 255) String author,
        @NotNull @Valid MediaItem file,
        @Valid MediaItem cover,
        @Valid MediaItem autoCover) {}

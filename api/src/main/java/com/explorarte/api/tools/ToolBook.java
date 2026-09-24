package com.explorarte.api.tools;

import com.explorarte.api.media.MediaItem;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Un libro del estante: un archivo con título, una descripción opcional (la
 * que aparece al lado del estante al pasar el cursor), y portada propia o
 * automática (la primera página del PDF, que genera el navegador de una
 * administradora).
 *
 * <p>{@code description} va al final a propósito: los libros guardados antes de
 * que existiera no la traen en el JSONB, y Jackson la deja en null. */
public record ToolBook(
        @NotBlank @Size(max = 64) String id,
        @NotBlank @Size(max = 255) String title,
        @Size(max = 255) String author,
        @NotNull @Valid MediaItem file,
        @Valid MediaItem cover,
        @Valid MediaItem autoCover,
        @Size(max = 1000) String description) {}

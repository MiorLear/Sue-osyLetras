package com.explorarte.api.tools;

import com.explorarte.api.media.MediaItem;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Un libro recomendado. {@code url} es la página del libro en otro sitio
 * (editorial, tienda), así que no se exige que apunte a nuestro almacenamiento;
 * {@link ToolsContentMapper#checkUrls} sí exige http(s). */
public record BibliographyEntry(
        @NotBlank @Size(max = 64) String id,
        @NotBlank @Size(max = 255) String title,
        @Size(max = 255) String author,
        @Valid MediaItem image,
        @Size(max = 2048) String url) {}

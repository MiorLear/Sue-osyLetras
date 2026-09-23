package com.explorarte.api.tools;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Cuerpo de PUT /tools. Los dos campos son obligatorios a propósito: un panel
 * de administración viejo manda la forma anterior, y sin esto guardaría una
 * biblioteca vacía encima de la de verdad. */
public record ToolsUpdateInput(
        @NotNull @Size(max = 40) List<@NotNull @Valid ToolShelf> shelves,
        @NotNull @Size(max = 200) List<@NotNull @Valid BibliographyEntry> bibliographyItems) {}

package com.explorarte.api.tools;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Un estante de la biblioteca: una categoría que la administradora nombra,
 * describe y ordena.
 *
 * <p>{@code description} es opcional: los estantes guardados antes de que
 * existiera no la traen en el JSONB, y Jackson la deja en null. */
public record ToolShelf(
        @NotBlank @Size(max = 64) String id,
        @NotBlank @Size(max = 120) String title,
        @NotNull @Size(max = 200) List<@NotNull @Valid ToolBook> books,
        @Size(max = 500) String description) {

    public ToolShelf(String id, String title, List<ToolBook> books) {
        this(id, title, books, null);
    }
}

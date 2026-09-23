package com.explorarte.api.tools;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;

import com.explorarte.api.media.MediaItem;
import com.explorarte.api.media.MediaUrlPolicy;

final class ToolsContentMapper {

    private ToolsContentMapper() {}

    static ToolsContentDto toDto(List<ToolShelf> shelves, List<BibliographyEntry> bibliography) {
        List<ToolShelf> safeShelves = shelves == null ? List.of() : shelves;
        List<BibliographyEntry> safeBibliography = bibliography == null ? List.of() : bibliography;

        List<MediaItem> files = new ArrayList<>();
        for (ToolShelf shelf : safeShelves) {
            if (shelf.books() == null) continue;
            for (ToolBook book : shelf.books()) {
                if (book.file() != null) files.add(book.file());
            }
        }
        List<String> titles = safeBibliography.stream()
                .map(e -> e.author() == null || e.author().isBlank() ? e.title() : e.title() + " — " + e.author())
                .toList();

        return new ToolsContentDto(safeShelves, safeBibliography, files, titles, null, List.of());
    }

    /** Todo archivo e imagen tiene que ser nuestro; el enlace a la página del libro, solo http(s). */
    static void checkUrls(ToolsUpdateInput input, MediaUrlPolicy policy) {
        for (ToolShelf shelf : input.shelves()) {
            for (ToolBook book : shelf.books()) {
                policy.checkStorageUrl(book.file().url());
                if (book.cover() != null) policy.checkStorageUrl(book.cover().url());
                if (book.autoCover() != null) policy.checkStorageUrl(book.autoCover().url());
            }
        }
        for (BibliographyEntry entry : input.bibliographyItems()) {
            if (entry.image() != null) policy.checkStorageUrl(entry.image().url());
            if (entry.url() != null && !entry.url().isBlank()) checkExternalLink(entry.url());
        }
    }

    static void checkExternalLink(String url) {
        URI uri;
        try {
            uri = new URI(url.trim());
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("El enlace del libro no es una URL válida");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (!scheme.equals("https") && !scheme.equals("http")) {
            throw new IllegalArgumentException("El enlace del libro tiene que empezar con http:// o https://");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException("El enlace del libro no tiene dominio");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalArgumentException("El enlace del libro no puede llevar credenciales");
        }
    }
}

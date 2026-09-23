package com.explorarte.api.tools;

import java.util.List;

import com.explorarte.api.media.MediaItem;

/**
 * {@code shelves} y {@code bibliographyItems} son la biblioteca. Los otros
 * cuatro son la forma anterior, derivada de esos dos por
 * {@link ToolsContentMapper}, para que una PWA vieja todavía en caché siga
 * pintando algo en vez de romperse. Nadie los escribe.
 */
public record ToolsContentDto(
        List<ToolShelf> shelves,
        List<BibliographyEntry> bibliographyItems,
        List<MediaItem> downloadables,
        List<String> bibliography,
        MediaItem manualDocument,
        List<MediaItem> activityGuides
) {}

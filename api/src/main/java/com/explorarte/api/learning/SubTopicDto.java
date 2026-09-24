package com.explorarte.api.learning;

import java.util.List;

import com.explorarte.api.media.MediaItem;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubTopicDto(
        /**
         * Clave estable dentro del tema, y la unica ancla del avance guardado.
         *
         * <p>Llega vacia al crear un subtema y el servidor la rellena; llega
         * puesta al actualizar, y entonces NO se toca. Regenerarla desde el
         * titulo desconectaria en silencio lo que cada docente lleva hecho.
         */
        @Size(max = 64) String key,
        @Size(max = 16) String emoji,
        @NotBlank @Size(max = 200) String title,
        /** Opcional. Nula o vacía = sin descripción. */
        @Size(max = 200) String description,
        @Valid @Size(max = 200) List<LearningBlock> blocks,
        @Valid List<MediaItem> pdfs,
        @Valid List<MediaItem> videos,
        @Valid List<MediaItem> audios
) {}

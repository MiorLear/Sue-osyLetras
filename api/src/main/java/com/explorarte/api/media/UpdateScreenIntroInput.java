package com.explorarte.api.media;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/**
 * El cuerpo del PUT. Reemplaza el recurso entero a proposito.
 *
 * <p>Antes recibia un {@link MediaItem} pelado, y con esa forma quitar el video
 * habria borrado los parrafos junto con el: no habia manera de expresar "deja
 * el texto, quita el archivo".
 */
public record UpdateScreenIntroInput(
        @Valid MediaItem video,
        @Size(max = 12) List<@Size(max = 2000) String> paragraphs
) {}

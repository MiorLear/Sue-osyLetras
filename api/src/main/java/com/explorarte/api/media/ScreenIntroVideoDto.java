package com.explorarte.api.media;

import java.util.List;

/**
 * La cabecera editable de una pantalla: sus parrafos de introduccion y el video
 * que los acompana.
 *
 * <p>El nombre se queda corto —empezo siendo solo el video— pero se conserva
 * porque lo importan la PWA, la app de RN, el cliente HTTP y el mock, y
 * renombrarlo no cambiaria ningun comportamiento.
 *
 * <p>Las dos partes son opcionales por separado: hay pantallas donde el texto
 * es todo lo que hay, y el video puede subirse despues.
 */
public record ScreenIntroVideoDto(String screenKey, MediaItem video, List<String> paragraphs) {}

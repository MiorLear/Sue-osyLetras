package com.explorarte.api.emotions;

import java.util.List;

/**
 * Una actividad de la Biblioteca de emociones.
 *
 * Se guardaba como una sola cadena de texto dentro del JSONB `activities`, y
 * por eso la tarjeta de la app no podía enseñar más que el nombre. Cada campo
 * de aquí es uno de los que el documento de estructura pide mostrar: propósito,
 * duración y edades en la tarjeta resumida; objetivo, materiales, paso a paso y
 * preguntas al desplegarla.
 *
 * Todo menos `title` puede venir vacío o nulo, y entonces la app no lo dibuja.
 * V9__emotion_activities_structured.sql convirtió las cadenas antiguas en
 * objetos con solo el título, así que ese es el estado esperado de lo ya
 * cargado hasta que alguien lo complete desde el CMS.
 */
public record EmotionActivity(
        String title,
        String purpose,
        String duration,
        String ages,
        String materials,
        List<String> steps,
        List<String> questions
) {}

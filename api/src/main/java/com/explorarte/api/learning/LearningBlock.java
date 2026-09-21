package com.explorarte.api.learning;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Un trozo de contenido de Aprendiendo, con su forma declarada.
 *
 * <p>Era una sola cadena ({@code SubTopic.body}), y por eso la pantalla no
 * podía enseñar más que un párrafo corrido. El material de las docentes no
 * tiene esa forma: alterna explicaciones con listas de prácticas, cuadros de
 * "Recuerda", frases que se pueden decir en el aula y preguntas para pensar.
 * Cada una de esas es un subtipo aquí, y el CMS las compone en el orden que
 * quiera.
 *
 * <h2>Por qué {@code @JsonTypeInfo} y no configurar el ObjectMapper</h2>
 *
 * <p>Hay <b>dos</b> ObjectMapper en juego. Spring MVC serializa el DTO con el
 * suyo autoconfigurado; Hibernate serializa la columna JSONB con el suyo
 * ({@code JacksonJsonFormatMapper}, instancia interna). Cualquier solución
 * basada en <i>configurar</i> el mapper —{@code activateDefaultTyping}, un
 * módulo con {@code registerSubtypes}, un serializador a medida— se aplicaría
 * solo al de Spring y produciría una forma en el cable y otra en la columna,
 * sin ningún test que lo delate hasta que alguien recargue el tema. Estas
 * anotaciones viven en la clase y las respetan los dos por construcción.
 *
 * <p>{@code kind} es además el mismo discriminante que usa la unión de
 * TypeScript en {@code shared/src/types/index.ts}, así que las dos definiciones
 * son espejo literal. Y {@code sealed} hace que añadir un subtipo rompa la
 * compilación de cualquier {@code switch} exhaustivo en vez de caer en un
 * {@code default} silencioso.
 *
 * <h2>El coste, dicho antes de que muerda</h2>
 *
 * <p>Un {@code kind} desconocido <b>al leer</b> es una excepción de Jackson
 * dentro de la carga de la entidad, así que {@code GET /learning/topics}
 * devolvería 500 entero, no un bloque de menos ({@code defaultImpl} no cubre
 * este caso: cubre el id ausente, no el id desconocido). En consecuencia,
 * <b>añadir un tipo de bloque es forward-only</b>: la revisión de la API que lo
 * conoce tiene que estar desplegada antes de que exista contenido que lo use, y
 * un rollback posterior a que alguien lo haya guardado tumbaría la pantalla. Se
 * cumple solo —solo el CMS escribe, y el CMS viaja con la API— pero conviene
 * saberlo antes de revertir un despliegue.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "kind")
@JsonSubTypes({
        @JsonSubTypes.Type(value = LearningBlock.Paragraph.class, name = "paragraph"),
        @JsonSubTypes.Type(value = LearningBlock.Heading.class, name = "heading"),
        @JsonSubTypes.Type(value = LearningBlock.Checklist.class, name = "checklist"),
        @JsonSubTypes.Type(value = LearningBlock.AvoidList.class, name = "avoidlist"),
        @JsonSubTypes.Type(value = LearningBlock.Callout.class, name = "callout"),
        @JsonSubTypes.Type(value = LearningBlock.Reflection.class, name = "reflection"),
        @JsonSubTypes.Type(value = LearningBlock.Quote.class, name = "quote"),
        @JsonSubTypes.Type(value = LearningBlock.Definitions.class, name = "definitions")
})
public sealed interface LearningBlock {

    /** Texto corrido. Los saltos de línea se respetan al pintarlo. */
    record Paragraph(@NotBlank @Size(max = 4000) String text) implements LearningBlock {}

    /** Título de sección dentro del subtema ("¿Por qué es importante?"). */
    record Heading(@NotBlank @Size(max = 200) String text) implements LearningBlock {}

    /** Lista de cosas que hacer, con viñeta ✔. */
    record Checklist(
            @JsonInclude(JsonInclude.Include.ALWAYS) @Size(max = 200) String title,
            @NotNull @Size(max = 60) List<@NotBlank @Size(max = 600) String> items
    ) implements LearningBlock {}

    /** Lista de cosas que evitar, con viñeta ✘. */
    record AvoidList(
            @JsonInclude(JsonInclude.Include.ALWAYS) @Size(max = 200) String title,
            @NotNull @Size(max = 60) List<@NotBlank @Size(max = 600) String> items
    ) implements LearningBlock {}

    /** El cuadro destacado. Sin título, la app lo pinta como "Recuerda". */
    record Callout(
            @JsonInclude(JsonInclude.Include.ALWAYS) @Size(max = 200) String title,
            @NotBlank @Size(max = 2000) String text
    ) implements LearningBlock {}

    /** Preguntas para pensar al cerrar ("Para reflexionar"). */
    record Reflection(
            @NotNull @Size(max = 20) List<@NotBlank @Size(max = 600) String> questions
    ) implements LearningBlock {}

    /** Una frase que la docente puede decir tal cual. Se pinta en cursiva. */
    record Quote(@NotBlank @Size(max = 1000) String text) implements LearningBlock {}

    /** Término + explicación, en filas. "La alegría nos invita a compartir…". */
    record Definitions(
            @JsonInclude(JsonInclude.Include.ALWAYS) @Size(max = 200) String title,
            @NotNull @Size(max = 30) List<@Valid @NotNull DefinitionItem> items
    ) implements LearningBlock {}

    /** Una fila de {@link Definitions}: lo que va en negrita y su explicación. */
    record DefinitionItem(
            @NotBlank @Size(max = 200) String term,
            @NotBlank @Size(max = 1000) String text
    ) {}
}

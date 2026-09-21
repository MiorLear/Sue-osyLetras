package com.explorarte.api.learning;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Como se recorre un tema. Lo elige la administradora desde el CMS, asi que un
 * tema nuevo no necesita codigo para presentarse de otra manera.
 *
 * <p>Ojo con las dos representaciones, que es la trampa que ya existia con
 * {@code EventType}: {@code @Enumerated(EnumType.STRING)} guarda el
 * {@code name()} —MAYUSCULAS— en la columna, mientras que {@code @JsonValue}
 * decide lo que viaja por el cable —minusculas—. El CHECK de la tabla valida lo
 * primero.
 */
public enum TopicLayout {
    /** Subtemas que se despliegan. Lo que habia, y el valor por defecto. */
    ACCORDION("accordion"),
    /** Mapa de fases, con el avance guardado por usuaria. */
    PATH("path"),
    /** El contenido se pasa tarjeta a tarjeta. */
    SLIDES("slides");

    private final String wire;

    TopicLayout(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String toJson() {
        return wire;
    }

    @JsonCreator
    public static TopicLayout fromJson(String value) {
        for (TopicLayout l : values()) {
            if (l.wire.equals(value)) return l;
        }
        throw new IllegalArgumentException("Unknown topic layout: " + value);
    }
}

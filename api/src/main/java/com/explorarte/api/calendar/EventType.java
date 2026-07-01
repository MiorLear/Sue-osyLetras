package com.explorarte.api.calendar;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum EventType {
    SESION("sesión"), TAREA("tarea"), RECORDATORIO("recordatorio"), EVENTO("evento");

    private final String wire;

    EventType(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String toJson() {
        return wire;
    }

    @JsonCreator
    public static EventType fromJson(String value) {
        for (EventType t : values()) {
            if (t.wire.equals(value)) return t;
        }
        throw new IllegalArgumentException("Unknown event type: " + value);
    }
}

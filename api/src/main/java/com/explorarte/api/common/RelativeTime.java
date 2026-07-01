package com.explorarte.api.common;

import java.time.Duration;
import java.time.Instant;

/** Renders a timestamp as a short Spanish relative string, matching the mock's "hace 2h" style. */
public final class RelativeTime {
    private RelativeTime() {}

    public static String from(Instant createdAt) {
        Duration d = Duration.between(createdAt, Instant.now());
        long seconds = Math.max(0, d.getSeconds());
        if (seconds < 60) return "ahora";
        long minutes = seconds / 60;
        if (minutes < 60) return "hace " + minutes + "min";
        long hours = minutes / 60;
        if (hours < 24) return "hace " + hours + "h";
        long days = hours / 24;
        return "hace " + days + "d";
    }
}

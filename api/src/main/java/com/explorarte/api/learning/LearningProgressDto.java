package com.explorarte.api.learning;

import java.time.Instant;

/**
 * Una fase completada, tal como la ve el frontend.
 *
 * <p>{@code stepKey} y no {@code subtopicKey}: la pantalla habla de "fases" del
 * mapa, y ese es el nombre del campo en {@code shared/src/types/index.ts}.
 * El {@code userId} no viaja — el GET solo devuelve lo de quien pregunta.
 */
public record LearningProgressDto(String topicId, String stepKey, Instant completedAt) {}

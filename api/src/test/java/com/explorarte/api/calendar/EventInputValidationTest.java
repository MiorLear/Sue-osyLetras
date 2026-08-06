package com.explorarte.api.calendar;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

class EventInputValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void openValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        factory.close();
    }

    private static Set<String> invalidPathsOf(Object input) {
        return validator.validate(input).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(String::valueOf)
                .collect(Collectors.toSet());
    }

    private static CreateEventInput valid() {
        return new CreateEventInput("Sesión de lectura", EventType.SESION, LocalDate.of(2026, 3, 1),
                "09:00", "10:30", "15 minutos antes", false);
    }

    @Test
    void acceptsAWellFormedEvent() {
        assertThat(invalidPathsOf(valid())).isEmpty();
    }

    @Test
    void requiresEveryNotNullColumn() {
        Set<String> invalid = invalidPathsOf(
                new CreateEventInput(null, null, null, null, null, null, null));
        assertThat(invalid).contains("title", "type", "date", "startTime", "endTime", "reminder");
    }

    @Test
    void rejectsMalformedTimes() {
        assertThat(invalidPathsOf(new CreateEventInput("t", EventType.TAREA, LocalDate.now(),
                "25:00", "10:00", "nunca", null))).contains("startTime");
        assertThat(invalidPathsOf(new CreateEventInput("t", EventType.TAREA, LocalDate.now(),
                "09:00", "9 de la mañana", "nunca", null))).contains("endTime");
    }

    @Test
    void capsTitleAndReminderToTheColumnWidths() {
        assertThat(invalidPathsOf(new CreateEventInput("t".repeat(201), EventType.EVENTO, LocalDate.now(),
                "09:00", "10:00", "nunca", null))).contains("title");
        assertThat(invalidPathsOf(new CreateEventInput("t", EventType.EVENTO, LocalDate.now(),
                "09:00", "10:00", "r".repeat(41), null))).contains("reminder");
    }

    @Test
    void updateTreatsEveryFieldAsOptionalButRejectsBlanks() {
        assertThat(invalidPathsOf(new UpdateEventInput(null, null, null, null, null, null, null))).isEmpty();
        assertThat(invalidPathsOf(new UpdateEventInput("Nuevo título", null, null, null, null, null, true))).isEmpty();
        assertThat(invalidPathsOf(new UpdateEventInput("  ", null, null, null, null, null, null)))
                .contains("titlePresentAndUsable");
        assertThat(invalidPathsOf(new UpdateEventInput(null, null, null, null, null, "  ", null)))
                .contains("reminderPresentAndUsable");
        assertThat(invalidPathsOf(new UpdateEventInput(null, null, null, "nope", null, null, null)))
                .contains("startTime");
    }
}

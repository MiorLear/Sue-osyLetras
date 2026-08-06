package com.explorarte.api.calendar;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Caps mirror calendar_events in V1__init_schema.sql: title VARCHAR(200),
 * start_time/end_time VARCHAR(10), reminder VARCHAR(40) NOT NULL. */
public record CreateEventInput(
        @NotBlank @Size(max = 200) String title,
        @NotNull EventType type,
        @NotNull LocalDate date,
        @NotBlank @Pattern(regexp = TimeFormat.PATTERN, message = TimeFormat.MESSAGE) String startTime,
        @NotBlank @Pattern(regexp = TimeFormat.PATTERN, message = TimeFormat.MESSAGE) String endTime,
        @NotBlank @Size(max = 40) String reminder,
        Boolean completed
) {}

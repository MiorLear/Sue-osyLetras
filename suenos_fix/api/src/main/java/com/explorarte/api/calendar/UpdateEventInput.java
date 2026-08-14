package com.explorarte.api.calendar;

import java.time.LocalDate;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Partial update: every field is optional, so nothing is @NotNull — but a
 * field that IS present has to be usable, since the controller writes it
 * straight onto the entity. */
public record UpdateEventInput(
        @Size(max = 200) String title,
        EventType type,
        LocalDate date,
        @Pattern(regexp = TimeFormat.PATTERN, message = TimeFormat.MESSAGE) String startTime,
        @Pattern(regexp = TimeFormat.PATTERN, message = TimeFormat.MESSAGE) String endTime,
        @Size(max = 40) String reminder,
        Boolean completed
) {
    /** @NotBlank cannot express "absent is fine, blank is not"; these can.
     * Both back NOT NULL columns, so a blank value would be a silent data loss. */
    @AssertTrue(message = "must not be blank when provided")
    public boolean isTitlePresentAndUsable() {
        return title == null || !title.isBlank();
    }

    @AssertTrue(message = "must not be blank when provided")
    public boolean isReminderPresentAndUsable() {
        return reminder == null || !reminder.isBlank();
    }
}

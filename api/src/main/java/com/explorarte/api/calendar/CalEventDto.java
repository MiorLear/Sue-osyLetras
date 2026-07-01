package com.explorarte.api.calendar;

import java.time.LocalDate;

public record CalEventDto(
        String id,
        String title,
        EventType type,
        LocalDate date,
        String startTime,
        String endTime,
        String reminder,
        Boolean completed
) {}

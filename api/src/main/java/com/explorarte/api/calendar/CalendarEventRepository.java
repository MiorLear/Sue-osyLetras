package com.explorarte.api.calendar;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, String> {
    List<CalendarEvent> findByOwnerUserId(String ownerUserId);
}

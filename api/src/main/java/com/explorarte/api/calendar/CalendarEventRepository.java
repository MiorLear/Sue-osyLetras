package com.explorarte.api.calendar;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, String> {
    Page<CalendarEvent> findByOwnerUserId(String ownerUserId, Pageable pageable);
}

package com.explorarte.api.calendar;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.common.AccessDeniedByPolicyException;
import com.explorarte.api.common.ResourceNotFoundException;
import com.explorarte.api.security.CurrentUserService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
public class EventController {

    private final CalendarEventRepository calendarEventRepository;
    private final CurrentUserService currentUserService;

    public EventController(CalendarEventRepository calendarEventRepository, CurrentUserService currentUserService) {
        this.calendarEventRepository = calendarEventRepository;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/events")
    public List<CalEventDto> list() {
        return calendarEventRepository.findByOwnerUserId(currentUserService.currentUserId())
                .stream().map(CalendarEvent::toDto).toList();
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    public CalEventDto create(@Valid @RequestBody CreateEventInput input) {
        CalendarEvent event = new CalendarEvent();
        event.setId(UUID.randomUUID().toString());
        event.setOwnerUserId(currentUserService.currentUserId());
        event.setTitle(input.title());
        event.setType(input.type());
        event.setDate(input.date());
        event.setStartTime(input.startTime());
        event.setEndTime(input.endTime());
        event.setReminder(input.reminder());
        event.setCompleted(input.completed());
        calendarEventRepository.save(event);
        return event.toDto();
    }

    @PutMapping("/events/{id}")
    public CalEventDto update(@PathVariable @NotBlank @Size(max = 64) String id,
            @Valid @RequestBody UpdateEventInput input) {
        CalendarEvent event = findOwned(id);
        if (input.title() != null) event.setTitle(input.title());
        if (input.type() != null) event.setType(input.type());
        if (input.date() != null) event.setDate(input.date());
        if (input.startTime() != null) event.setStartTime(input.startTime());
        if (input.endTime() != null) event.setEndTime(input.endTime());
        if (input.reminder() != null) event.setReminder(input.reminder());
        if (input.completed() != null) event.setCompleted(input.completed());
        calendarEventRepository.save(event);
        return event.toDto();
    }

    @DeleteMapping("/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable @NotBlank @Size(max = 64) String id) {
        calendarEventRepository.delete(findOwned(id));
    }

    private CalendarEvent findOwned(String id) {
        CalendarEvent event = calendarEventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event"));
        if (!event.getOwnerUserId().equals(currentUserService.currentUserId())) {
            throw new AccessDeniedByPolicyException("Event does not belong to the current user");
        }
        return event;
    }
}

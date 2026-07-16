package com.explorarte.api.misc;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps the shared institution list growing: whenever someone registers or
 * updates their profile with an institution that isn't listed yet, it's added
 * so it appears in the dropdown for everyone afterward.
 */
@Service
public class SchoolService {

    private final SchoolRepository schoolRepository;

    public SchoolService(SchoolRepository schoolRepository) {
        this.schoolRepository = schoolRepository;
    }

    /** Adds the institution to the shared list if it isn't already there. No-op for blanks. */
    @Transactional
    public void addIfNew(String name) {
        if (name == null) {
            return;
        }
        String trimmed = name.trim();
        if (trimmed.isEmpty() || schoolRepository.existsByNameIgnoreCase(trimmed)) {
            return;
        }
        try {
            School school = new School();
            school.setName(trimmed);
            schoolRepository.save(school);
        } catch (DataIntegrityViolationException ignored) {
            // A concurrent insert (or case-variant unique collision) already added it — fine.
        }
    }
}

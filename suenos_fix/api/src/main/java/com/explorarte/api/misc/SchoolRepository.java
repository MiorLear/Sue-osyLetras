package com.explorarte.api.misc;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SchoolRepository extends JpaRepository<School, Long> {
    boolean existsByNameIgnoreCase(String name);
}

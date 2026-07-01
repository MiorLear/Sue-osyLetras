package com.explorarte.api.misc;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SchoolsController {

    private final SchoolRepository schoolRepository;

    public SchoolsController(SchoolRepository schoolRepository) {
        this.schoolRepository = schoolRepository;
    }

    @GetMapping("/schools")
    public List<String> schools() {
        return schoolRepository.findAll().stream().map(School::getName).toList();
    }
}

package com.explorarte.api.auth;

public record RegisterInput(
        String name,
        String lastname,
        String institucion,
        String ubicacion,
        String email,
        String password,
        String phone
) {}

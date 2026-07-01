package com.explorarte.api.user;

public record UpdateProfileInput(
        String name,
        String lastname,
        String email,
        String phone,
        String institucion,
        String ubicacion,
        String photo
) {}

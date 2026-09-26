package com.explorarte.api.user;

public record UserProfileDto(
        String id,
        String name,
        String lastname,
        String email,
        String phone,
        String institucion,
        String ubicacion,
        UserRole role,
        UserStatus status,
        String photo,
        /** Falso mientras la cuenta invitada no haya completado su perfil. */
        boolean profileCompleted
) {}

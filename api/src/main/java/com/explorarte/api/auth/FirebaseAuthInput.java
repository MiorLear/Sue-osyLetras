package com.explorarte.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Optional profile fields are supplied only while completing a new registration. */
public record FirebaseAuthInput(
        @NotBlank @Size(max = 4096) String idToken,
        @Size(max = 100) String name,
        @Size(max = 100) String lastname,
        @Size(max = 160) String ubicacion,
        /** Token de invitacion, cuando el alta viene de un correo del admin. */
        @Size(max = 200) String invitationToken) {
}

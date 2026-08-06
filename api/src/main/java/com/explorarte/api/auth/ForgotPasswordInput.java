package com.explorarte.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * SEC-07. Accepts either an email or a phone, so the only checks that can apply are
 * "present" and "not longer than the widest column it is matched against"
 * ({@code users.email VARCHAR(160)}).
 */
public record ForgotPasswordInput(
        @NotBlank(message = "Ingresa tu correo o teléfono")
        @Size(max = 160, message = "El valor no puede exceder 160 caracteres")
        String emailOrPhone
) {}

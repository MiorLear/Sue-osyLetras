package com.explorarte.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** SEC-07. The cap matches {@code users.phone VARCHAR(40)} in V1__init_schema.sql. */
public record OtpRequestInput(
        @NotBlank(message = "El teléfono es obligatorio")
        @Size(max = 40, message = "El teléfono no puede exceder 40 caracteres")
        @Pattern(regexp = "^[+0-9()\\s.-]{6,40}$",
                message = "El teléfono solo puede contener dígitos y los signos + ( ) . -")
        String phone
) {}

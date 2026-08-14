package com.explorarte.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * SEC-07. Constraining the code to exactly six digits also means a malformed guess is
 * rejected before it can spend a verification attempt (SEC-05).
 */
public record OtpVerifyInput(
        @NotBlank(message = "El teléfono es obligatorio")
        @Size(max = 40, message = "El teléfono no puede exceder 40 caracteres")
        @Pattern(regexp = "^[+0-9()\\s.-]{6,40}$",
                message = "El teléfono solo puede contener dígitos y los signos + ( ) . -")
        String phone,

        @NotBlank(message = "El código es obligatorio")
        @Pattern(regexp = "^\\d{6}$", message = "El código debe tener 6 dígitos")
        String code
) {}

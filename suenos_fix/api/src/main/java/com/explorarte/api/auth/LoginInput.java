package com.explorarte.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * SEC-07: the length cap matches {@code users.email VARCHAR(160)} in V1__init_schema.sql, so
 * an oversize string is a 400 with a field-level message instead of a 500 from the database.
 *
 * <p>Deliberately no <em>minimum</em> length on the password: accounts created before the
 * policy existed may hold a shorter one, and refusing to even attempt their login would lock
 * them out. The maximum is checked in the controller, in bytes (see {@link PasswordPolicy}).
 */
public record LoginInput(
        @NotBlank(message = "El correo es obligatorio")
        @Email(message = "El correo no tiene un formato válido")
        @Size(max = 160, message = "El correo no puede exceder 160 caracteres")
        String email,

        @NotBlank(message = "La contraseña es obligatoria")
        @Size(max = 200, message = "La contraseña no puede exceder 200 caracteres")
        String password
) {}

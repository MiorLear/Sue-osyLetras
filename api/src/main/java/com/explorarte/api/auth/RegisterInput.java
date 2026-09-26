package com.explorarte.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * SEC-07 / SEC-13. Every cap matches the column it lands in (V1__init_schema.sql), so an
 * oversize value is a 400 with a field-level message rather than a 500 from the database.
 *
 * <p>Ya no hay alta por telefono, asi que correo y contrasena son obligatorios los dos.
 * La institucion tampoco se pide: toda cuenta nace con
 * {@link com.explorarte.api.user.User#INSTITUCION_POR_DEFECTO}.
 */
public record RegisterInput(
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 120, message = "El nombre no puede exceder 120 caracteres")
        String name,

        @NotBlank(message = "El apellido es obligatorio")
        @Size(max = 120, message = "El apellido no puede exceder 120 caracteres")
        String lastname,

        @Size(max = 160, message = "La ubicación no puede exceder 160 caracteres")
        String ubicacion,

        @NotBlank(message = "El correo es obligatorio")
        @Email(message = "El correo no tiene un formato válido")
        @Size(max = 160, message = "El correo no puede exceder 160 caracteres")
        String email,

        // (?s) so a password containing a newline is measured, not silently rejected.
        @NotBlank(message = "La contraseña es obligatoria")
        @Pattern(regexp = "(?s)^.{" + PasswordPolicy.MIN_LENGTH + ",}$",
                message = "La contraseña debe tener al menos 8 caracteres")
        String password,

        /** Token de invitacion, cuando el alta viene de un correo del admin. */
        @Size(max = 200, message = "El token de invitación no es válido")
        String invitationToken
) {}

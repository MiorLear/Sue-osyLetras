package com.explorarte.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * SEC-07 / SEC-13. Every cap matches the column it lands in (V1__init_schema.sql), so an
 * oversize value is a 400 with a field-level message rather than a 500 from the database.
 *
 * <p>{@code email} and {@code password} are optional <em>as annotations</em> because the
 * clients support a phone-only signup where the credential is the OTP, not a password
 * (web/src/routes/Register.tsx and src/app/register.tsx both post {@code password: ""} on
 * that path). The rule that actually matters — an email signup must carry a password that
 * meets {@link PasswordPolicy} — spans two fields and is enforced in the controller.
 */
public record RegisterInput(
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 120, message = "El nombre no puede exceder 120 caracteres")
        String name,

        @NotBlank(message = "El apellido es obligatorio")
        @Size(max = 120, message = "El apellido no puede exceder 120 caracteres")
        String lastname,

        @Size(max = 160, message = "La institución no puede exceder 160 caracteres")
        String institucion,

        @Size(max = 160, message = "La ubicación no puede exceder 160 caracteres")
        String ubicacion,

        // @Email passes on null and on "" — exactly what the phone-only signup posts.
        @Email(message = "El correo no tiene un formato válido")
        @Size(max = 160, message = "El correo no puede exceder 160 caracteres")
        String email,

        // Blank means "no password" (phone-only signup). Anything else must meet the policy.
        // (?s) so a password containing a newline is measured, not silently rejected.
        @Pattern(regexp = "(?s)^$|^.{" + PasswordPolicy.MIN_LENGTH + ",}$",
                message = "La contraseña debe tener al menos 8 caracteres")
        String password,

        @Size(max = 40, message = "El teléfono no puede exceder 40 caracteres")
        @Pattern(regexp = "^$|^[+0-9()\\s.-]{6,40}$",
                message = "El teléfono solo puede contener dígitos y los signos + ( ) . -")
        String phone
) {}

package com.explorarte.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * SEC-07 / SEC-13. The minimum used to be a hand-rolled {@code length() < 6} check inside the
 * controller; the policy now lives in one place ({@link PasswordPolicy}) and is the same one
 * registration applies. The byte-level maximum is checked in the controller.
 */
public record ResetPasswordInput(
        @NotBlank(message = "Ingresa tu correo o teléfono")
        @Size(max = 160, message = "El valor no puede exceder 160 caracteres")
        String emailOrPhone,

        @NotBlank(message = "El código es obligatorio")
        @Pattern(regexp = "^\\d{6}$", message = "El código debe tener 6 dígitos")
        String code,

        @NotBlank(message = "La nueva contraseña es obligatoria")
        @Size(min = PasswordPolicy.MIN_LENGTH, max = 200,
                message = "La contraseña debe tener al menos 8 caracteres")
        String newPassword
) {}

package com.explorarte.api.user;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Partial update of the signed-in user's own profile. Caps mirror the users
 * table in V1__init_schema.sql (name/lastname 120, email 160, phone 40,
 * institucion/ubicacion 160); photo is TEXT and holds a URL. */
public record UpdateProfileInput(
        @Size(max = 120) String name,
        @Size(max = 120) String lastname,
        @Email(message = "must be a valid email address") @Size(max = 160) String email,
        // Empty is allowed on purpose: the clients always send every text field,
        // and an account without a phone posts "".
        @Pattern(regexp = "^$|^[0-9+()\\s.-]{6,40}$", message = "must be a valid phone number") String phone,
        @Size(max = 160) String institucion,
        @Size(max = 160) String ubicacion,
        @Size(max = 2048) String photo
) {
    /** name and lastname back NOT NULL columns, so an explicit blank would be
     * a silent wipe rather than a no-op. */
    @AssertTrue(message = "must not be blank when provided")
    public boolean isNamePresentAndUsable() {
        return name == null || !name.isBlank();
    }

    @AssertTrue(message = "must not be blank when provided")
    public boolean isLastnamePresentAndUsable() {
        return lastname == null || !lastname.isBlank();
    }

    /** @Email accepts the empty string; the login identity must not become "". */
    @AssertTrue(message = "must not be blank when provided")
    public boolean isEmailPresentAndUsable() {
        return email == null || !email.isBlank();
    }
}

package com.explorarte.api.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InviteUserInput(
        @NotBlank @Email @Size(max = 254) String email) {
}

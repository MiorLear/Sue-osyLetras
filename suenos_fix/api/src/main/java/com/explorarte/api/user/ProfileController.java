package com.explorarte.api.user;

import java.util.Locale;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.common.ConflictException;
import com.explorarte.api.media.MediaUrlPolicy;
import com.explorarte.api.misc.SchoolService;
import com.explorarte.api.security.CurrentUserService;

import jakarta.validation.Valid;

@RestController
public class ProfileController {

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final SchoolService schoolService;
    private final MediaUrlPolicy mediaUrlPolicy;

    public ProfileController(CurrentUserService currentUserService, UserRepository userRepository,
            SchoolService schoolService, MediaUrlPolicy mediaUrlPolicy) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.schoolService = schoolService;
        this.mediaUrlPolicy = mediaUrlPolicy;
    }

    @GetMapping("/me")
    public UserProfileDto get() {
        return currentUserService.currentUser().toDto();
    }

    @PutMapping("/me")
    public UserProfileDto update(@Valid @RequestBody UpdateProfileInput input) {
        User user = currentUserService.currentUser();
        if (input.name() != null) user.setName(input.name().trim());
        if (input.lastname() != null) user.setLastname(input.lastname().trim());
        if (input.email() != null) applyEmailChange(user, input.email());
        if (input.phone() != null) user.setPhone(input.phone().isBlank() ? null : input.phone().trim());
        if (input.institucion() != null) user.setInstitucion(input.institucion().trim());
        if (input.ubicacion() != null) user.setUbicacion(input.ubicacion().trim());
        if (input.photo() != null) {
            if (input.photo().isBlank()) {
                user.setPhoto(null);
            } else {
                mediaUrlPolicy.checkImageUrl(input.photo());
                user.setPhoto(input.photo());
            }
        }
        userRepository.save(user);
        schoolService.addIfNew(user.getInstitucion());
        return user.toDto();
    }

    /**
     * BUG-13 — the email column is the login identity and is UNIQUE, but this
     * endpoint used to write it through unchecked: a collision surfaced as a
     * 500 from the constraint. The format is validated on the input record, the
     * address is normalised, and the collision is answered with a 409.
     *
     * <p>Still missing by design here: the new address is not re-verified, so a
     * user can move their login identity without proving they own the mailbox.
     * That belongs with the verification flow in the auth package rather than
     * in this controller.
     */
    private void applyEmailChange(User user, String rawEmail) {
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        if (email.equalsIgnoreCase(user.getEmail())) return;
        userRepository.findByEmailIgnoreCase(email)
                .filter(other -> !other.getId().equals(user.getId()))
                .ifPresent(other -> {
                    throw new ConflictException("That email address is already in use");
                });
        user.setEmail(email);
    }
}

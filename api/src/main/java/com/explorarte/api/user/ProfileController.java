package com.explorarte.api.user;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.security.CurrentUserService;

@RestController
public class ProfileController {

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;

    public ProfileController(CurrentUserService currentUserService, UserRepository userRepository) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public UserProfileDto get() {
        return currentUserService.currentUser().toDto();
    }

    @PutMapping("/me")
    public UserProfileDto update(@RequestBody UpdateProfileInput input) {
        User user = currentUserService.currentUser();
        if (input.name() != null) user.setName(input.name());
        if (input.lastname() != null) user.setLastname(input.lastname());
        if (input.email() != null) user.setEmail(input.email());
        if (input.phone() != null) user.setPhone(input.phone());
        if (input.institucion() != null) user.setInstitucion(input.institucion());
        if (input.ubicacion() != null) user.setUbicacion(input.ubicacion());
        if (input.photo() != null) user.setPhoto(input.photo());
        userRepository.save(user);
        return user.toDto();
    }
}

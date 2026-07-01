package com.explorarte.api.security;

import java.util.NoSuchElementException;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;

@Service
public class CurrentUserService {

    private final UserRepository userRepository;

    public CurrentUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public String currentUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            throw new IllegalStateException("No authenticated user in context");
        }
        return (String) auth.getPrincipal();
    }

    public User currentUser() {
        return userRepository.findById(currentUserId())
                .orElseThrow(() -> new NoSuchElementException("Authenticated user not found"));
    }
}

package com.explorarte.api.user;

import java.util.List;
import java.util.NoSuchElementException;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdminUserController {

    private final UserRepository userRepository;

    public AdminUserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/admin/users")
    public List<UserProfileDto> list(@RequestParam(required = false) UserStatus status) {
        List<User> users = status == null ? userRepository.findAll() : userRepository.findByStatus(status);
        return users.stream().map(User::toDto).toList();
    }

    @PostMapping("/admin/users/{id}/approve")
    public UserProfileDto approve(@PathVariable String id) {
        User user = find(id);
        user.setStatus(UserStatus.APPROVED);
        userRepository.save(user);
        return user.toDto();
    }

    @PostMapping("/admin/users/{id}/reject")
    public UserProfileDto reject(@PathVariable String id) {
        User user = find(id);
        user.setStatus(UserStatus.REJECTED);
        userRepository.save(user);
        return user.toDto();
    }

    private User find(String id) {
        return userRepository.findById(id).orElseThrow(() -> new NoSuchElementException("User not found: " + id));
    }
}

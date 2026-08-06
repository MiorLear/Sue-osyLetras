package com.explorarte.api.user;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.common.PageResponse;
import com.explorarte.api.common.Pagination;
import com.explorarte.api.common.ResourceNotFoundException;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
public class AdminUserController {

    private final UserRepository userRepository;

    public AdminUserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** Newest registrations first — the approval queue is what an admin opens
     * this list for — with the id as a stable tie-breaker. */
    private static final Sort ROSTER_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id"));

    /**
     * SCALE-01 — see PostController.list: {@code page}/{@code size} switch the
     * body to a {@link PageResponse} envelope, their absence keeps the bare
     * array the admin console reads, bounded at {@link Pagination#LEGACY_CAP}.
     */
    @GetMapping("/admin/users")
    public Object list(
            @RequestParam(required = false) UserStatus status,
            @RequestParam(required = false) @Min(0) Integer page,
            @RequestParam(required = false) @Min(1) @Max(Pagination.MAX_SIZE) Integer size) {

        Pageable pageable = Pagination.of(page, size, ROSTER_SORT);
        Page<User> users = status == null
                ? userRepository.findAll(pageable)
                : userRepository.findByStatus(status, pageable);
        List<UserProfileDto> items = users.getContent().stream().map(User::toDto).toList();
        return Pagination.isRequested(page, size) ? PageResponse.of(users, items) : items;
    }

    @PostMapping("/admin/users/{id}/approve")
    public UserProfileDto approve(@PathVariable @NotBlank @Size(max = 64) String id) {
        User user = find(id);
        user.setStatus(UserStatus.APPROVED);
        userRepository.save(user);
        return user.toDto();
    }

    @PostMapping("/admin/users/{id}/reject")
    public UserProfileDto reject(@PathVariable @NotBlank @Size(max = 64) String id) {
        User user = find(id);
        user.setStatus(UserStatus.REJECTED);
        userRepository.save(user);
        return user.toDto();
    }

    private User find(String id) {
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User"));
    }
}

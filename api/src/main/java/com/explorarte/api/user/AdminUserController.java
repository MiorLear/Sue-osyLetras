package com.explorarte.api.user;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;

import com.explorarte.api.common.PageResponse;
import com.explorarte.api.common.Pagination;
import com.explorarte.api.common.ResourceNotFoundException;
import com.explorarte.api.security.AuthenticatedUserCache;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;

@RestController
public class AdminUserController {

    private final UserRepository userRepository;
    private final FirebaseAuth firebaseAuth;
    private final AuthenticatedUserCache userCache;

    @Autowired
    public AdminUserController(UserRepository userRepository, FirebaseAuth firebaseAuth,
            AuthenticatedUserCache userCache) {
        this.userRepository = userRepository;
        this.firebaseAuth = firebaseAuth;
        this.userCache = userCache;
    }

    AdminUserController(UserRepository userRepository) {
        this(userRepository, null, null);
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

    /**
     * Turns a teacher into an administrator. Idempotent for an existing admin.
     *
     * <p>A rejected account is refused instead of silently re-approved: giving
     * someone back their access and handing them the admin console are two
     * decisions, and the second shouldn't smuggle in the first. A pending one is
     * approved on the way, since an admin waiting on the approval queue makes no sense.
     *
     * <p>The JWT filter reads the role from the database, so the account's existing
     * token gains the privileges on its next request once the cached snapshot is dropped.
     */
    @PostMapping("/admin/users/{id}/promote")
    public UserProfileDto promote(@PathVariable @NotBlank @Size(max = 64) String id) {
        User user = find(id);
        if (user.getRole() == UserRole.ADMIN) {
            return user.toDto();
        }
        if (user.getStatus() == UserStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Primero dale acceso a la cuenta antes de hacerla administradora");
        }
        user.setRole(UserRole.ADMIN);
        user.setStatus(UserStatus.APPROVED);
        userRepository.save(user);
        if (userCache != null) {
            userCache.invalidate(user.getId());
        }
        return user.toDto();
    }

    @DeleteMapping("/admin/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable @NotBlank @Size(max = 64) String id) {
        User user = find(id);
        if (user.getRole() == UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No se puede eliminar una cuenta administradora");
        }
        removeFirebaseIdentity(user.getEmail());
        userRepository.delete(user);
    }

    private void removeFirebaseIdentity(String email) {
        if (firebaseAuth == null || email == null || email.endsWith("@sinemail.explorarte")) return;
        try {
            firebaseAuth.deleteUser(firebaseAuth.getUserByEmail(email).getUid());
        } catch (FirebaseAuthException ex) {
            if (ex.getAuthErrorCode() != AuthErrorCode.USER_NOT_FOUND) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "No se pudo eliminar la identidad de Firebase", ex);
            }
        }
    }

    private User find(String id) {
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User"));
    }
}

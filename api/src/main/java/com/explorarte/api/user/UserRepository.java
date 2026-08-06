package com.explorarte.api.user;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmailIgnoreCase(String email);

    Page<User> findByStatus(UserStatus status, Pageable pageable);

    /**
     * SCALE-02: the OTP and forgot-password endpoints used to load every user row into
     * memory to find one by phone, on public unthrottled endpoints.
     *
     * <p>{@code findFirst} rather than a unique lookup because {@code phone} has no unique
     * constraint yet (SEC-18) — this preserves the existing "whichever row comes first"
     * behaviour instead of turning a duplicate into a runtime exception. Adding the
     * constraint needs a data migration to resolve existing duplicates.
     */
    Optional<User> findFirstByPhone(String phone);
}

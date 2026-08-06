package com.explorarte.api.security;

import java.time.Duration;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

/**
 * Loads the role, status and token version of an authenticated caller from the database,
 * behind a very short-lived cache (SEC-09).
 *
 * <p>The JWT filter used to take the {@code role} claim at face value, so a demoted or
 * rejected account kept its privileges until the token expired 24 hours later. Reading the
 * row on every request fixes that; the cache keeps it from becoming a database query per
 * HTTP call. The TTL is the worst-case window in which a revocation is not yet visible —
 * seconds, not hours.
 *
 * <p>Only an immutable snapshot is cached, never the JPA entity, so nothing detached leaks
 * into request handling.
 */
@Component
public class AuthenticatedUserCache {

    /** What the filter actually needs to make an authorization decision. */
    public record Snapshot(String id, UserRole role, UserStatus status, int tokenVersion) {
        public boolean isApproved() {
            return status == UserStatus.APPROVED;
        }
    }

    private final UserRepository userRepository;
    private final Cache<String, Optional<Snapshot>> cache;

    public AuthenticatedUserCache(
            UserRepository userRepository,
            @Value("${app.auth.user-cache-seconds:5}") long cacheSeconds,
            @Value("${app.auth.user-cache-max-entries:20000}") long maxEntries) {
        this.userRepository = userRepository;
        this.cache = Caffeine.newBuilder()
                .maximumSize(Math.max(100, maxEntries))
                .expireAfterWrite(Duration.ofSeconds(Math.max(0, cacheSeconds)))
                .build();
    }

    /** Empty when the account no longer exists — a deleted user's token stops working. */
    public Optional<Snapshot> find(String userId) {
        if (userId == null || userId.isBlank()) {
            return Optional.empty();
        }
        return cache.get(userId, this::load);
    }

    /** Drops the cached snapshot so a revocation takes effect now instead of after the TTL. */
    public void invalidate(String userId) {
        if (userId != null) {
            cache.invalidate(userId);
        }
    }

    private Optional<Snapshot> load(String userId) {
        return userRepository.findById(userId)
                .map(u -> new Snapshot(u.getId(), u.getRole(), u.getStatus(), u.getTokenVersion()));
    }
}

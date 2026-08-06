package com.explorarte.api.security;

import java.time.Duration;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;

/**
 * Token-bucket throttling for the auth endpoints (SEC-05).
 *
 * <p>Two independent budgets:
 * <ul>
 *   <li><b>per IP</b> — applied by {@link AuthRateLimitFilter} to every {@code /auth/**}
 *       request, so a single host cannot walk the 6-digit OTP space.</li>
 *   <li><b>per identifier</b> — applied by the controller once the email/phone is known, so
 *       a distributed attempt against one account is throttled too.</li>
 * </ul>
 *
 * <p>Buckets live in Caffeine caches with a maximum size and idle expiry: an attacker
 * rotating keys cannot grow this map without bound.
 *
 * <p>State is per-instance. On Render the API runs as a single container, so this is
 * effective today; a multi-instance deployment would want the Redis-backed Bucket4j
 * proxy manager instead.
 */
@Component
public class AuthRateLimiter {

    private final boolean enabled;
    private final int ipCapacity;
    private final Duration ipWindow;
    private final int identifierCapacity;
    private final Duration identifierWindow;

    private final Cache<String, Bucket> ipBuckets;
    private final Cache<String, Bucket> identifierBuckets;

    public AuthRateLimiter(
            @Value("${app.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.rate-limit.ip-capacity:30}") int ipCapacity,
            @Value("${app.rate-limit.ip-window-seconds:300}") long ipWindowSeconds,
            @Value("${app.rate-limit.identifier-capacity:10}") int identifierCapacity,
            @Value("${app.rate-limit.identifier-window-seconds:300}") long identifierWindowSeconds,
            @Value("${app.rate-limit.max-tracked-keys:50000}") long maxTrackedKeys) {
        this.enabled = enabled;
        this.ipCapacity = Math.max(1, ipCapacity);
        this.ipWindow = Duration.ofSeconds(Math.max(1, ipWindowSeconds));
        this.identifierCapacity = Math.max(1, identifierCapacity);
        this.identifierWindow = Duration.ofSeconds(Math.max(1, identifierWindowSeconds));
        this.ipBuckets = buildCache(maxTrackedKeys, this.ipWindow);
        this.identifierBuckets = buildCache(maxTrackedKeys, this.identifierWindow);
    }

    private static Cache<String, Bucket> buildCache(long maxTrackedKeys, Duration window) {
        return Caffeine.newBuilder()
                .maximumSize(Math.max(1_000, maxTrackedKeys))
                // Twice the window: a bucket that has been idle that long is fully refilled
                // anyway, so dropping it changes nothing an attacker can exploit.
                .expireAfterAccess(window.multipliedBy(2))
                .build();
    }

    /** Charges one request against the caller's IP budget. */
    public void checkIp(String ip) {
        consume(ipBuckets, "ip:" + (ip == null ? "unknown" : ip), ipCapacity, ipWindow);
    }

    /**
     * Charges one request against a single account's budget.
     *
     * @param scope the operation ("login", "otp-verify", …) so a login storm does not eat
     *              the password-reset budget for the same person
     */
    public void checkIdentifier(String scope, String identifier) {
        String key = scope + ":" + (identifier == null ? "" : identifier.trim().toLowerCase(Locale.ROOT));
        consume(identifierBuckets, key, identifierCapacity, identifierWindow);
    }

    private void consume(Cache<String, Bucket> cache, String key, int capacity, Duration window) {
        if (!enabled) {
            return;
        }
        Bucket bucket = cache.get(key, k -> newBucket(capacity, window));
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (!probe.isConsumed()) {
            long seconds = Duration.ofNanos(probe.getNanosToWaitForRefill()).toSeconds();
            throw new RateLimitExceededException(seconds);
        }
    }

    private static Bucket newBucket(int capacity, Duration window) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(capacity)
                        // Greedy refill: the budget trickles back over the window instead of
                        // unlocking all at once, which smooths bursts at the window boundary.
                        .refillGreedy(capacity, window)
                        .build())
                .build();
    }
}

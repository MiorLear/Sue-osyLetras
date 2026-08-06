package com.explorarte.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** SEC-05 — /auth/** must stop answering once an IP or an account has spent its budget. */
class AuthRateLimiterTest {

    private static AuthRateLimiter limiter(int ipCapacity, int identifierCapacity) {
        return new AuthRateLimiter(true, ipCapacity, 300, identifierCapacity, 300, 10_000);
    }

    @Test
    void theIpBudgetRunsOutAndReportsARetryDelay() {
        AuthRateLimiter limiter = limiter(3, 100);

        for (int i = 0; i < 3; i++) {
            limiter.checkIp("203.0.113.7");
        }

        assertThatThrownBy(() -> limiter.checkIp("203.0.113.7"))
                .isInstanceOf(RateLimitExceededException.class)
                .extracting(ex -> ((RateLimitExceededException) ex).retryAfterSeconds())
                .satisfies(seconds -> assertThat((Long) seconds).isPositive());
    }

    @Test
    void oneExhaustedIpDoesNotBlockAnother() {
        AuthRateLimiter limiter = limiter(2, 100);
        limiter.checkIp("203.0.113.7");
        limiter.checkIp("203.0.113.7");

        assertThatThrownBy(() -> limiter.checkIp("203.0.113.7"))
                .isInstanceOf(RateLimitExceededException.class);
        assertThatCode(() -> limiter.checkIp("198.51.100.4")).doesNotThrowAnyException();
    }

    @Test
    void theIdentifierBudgetIsPerAccountAndCaseInsensitive() {
        AuthRateLimiter limiter = limiter(1000, 3);

        limiter.checkIdentifier("login", "Maria@Ejemplo.com");
        limiter.checkIdentifier("login", "maria@ejemplo.com");
        limiter.checkIdentifier("login", "MARIA@EJEMPLO.COM");

        assertThatThrownBy(() -> limiter.checkIdentifier("login", "maria@ejemplo.com"))
                .isInstanceOf(RateLimitExceededException.class);
        assertThatCode(() -> limiter.checkIdentifier("login", "ana@ejemplo.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void budgetsAreScopedPerOperation() {
        AuthRateLimiter limiter = limiter(1000, 2);

        limiter.checkIdentifier("login", "maria@ejemplo.com");
        limiter.checkIdentifier("login", "maria@ejemplo.com");
        assertThatThrownBy(() -> limiter.checkIdentifier("login", "maria@ejemplo.com"))
                .isInstanceOf(RateLimitExceededException.class);

        // A login storm must not lock the same person out of password recovery.
        assertThatCode(() -> limiter.checkIdentifier("forgot-password", "maria@ejemplo.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void disablingTheLimiterTurnsEveryCheckIntoANoOp() {
        AuthRateLimiter limiter = new AuthRateLimiter(false, 1, 300, 1, 300, 10_000);

        assertThatCode(() -> {
            for (int i = 0; i < 50; i++) {
                limiter.checkIp("203.0.113.7");
                limiter.checkIdentifier("login", "maria@ejemplo.com");
            }
        }).doesNotThrowAnyException();
    }
}

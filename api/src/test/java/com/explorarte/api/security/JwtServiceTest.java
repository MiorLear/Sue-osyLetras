package com.explorarte.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** SEC-03 — the signing key must fail closed instead of falling back to a public literal. */
class JwtServiceTest {

    private static final String GOOD_SECRET = "unit-test-secret-0123456789-0123456789-abcdef";

    @Test
    void rejectsAnAbsentSecret() {
        assertThatThrownBy(() -> new JwtService(null, 60))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET is not set");
        assertThatThrownBy(() -> new JwtService("   ", 60))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET is not set");
    }

    @Test
    void rejectsTheOldPublicDefault() {
        assertThatThrownBy(() -> new JwtService("dev-only-not-for-production-change-me", 60))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("well-known placeholder");
    }

    @Test
    void rejectsAKeyShorterThanHs256Requires() {
        assertThatThrownBy(() -> new JwtService("too-short-for-hs256", 60))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32 bytes");
    }

    @Test
    void acceptsARealKeyAndRoundTripsAToken() {
        JwtService service = new JwtService(GOOD_SECRET, 60);
        String token = service.generate("u-admin", "ADMIN");

        var claims = service.parse(token);
        assertThat(claims.getSubject()).isEqualTo("u-admin");
        assertThat(claims.get("role", String.class)).isEqualTo("ADMIN");
    }

    @Test
    void aTokenSignedWithAnotherKeyIsRejected() {
        String foreign = new JwtService("a-completely-different-secret-key-0123456789", 60)
                .generate("u-admin", "ADMIN");
        JwtService service = new JwtService(GOOD_SECRET, 60);

        assertThatThrownBy(() -> service.parse(foreign))
                .isInstanceOf(io.jsonwebtoken.JwtException.class);
    }

    @Test
    void aValidKeyDoesNotThrow() {
        assertThatCode(() -> new JwtService(GOOD_SECRET, 60)).doesNotThrowAnyException();
    }
}

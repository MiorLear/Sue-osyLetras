package com.explorarte.api.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Set;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * Issues and parses the API's JWTs.
 *
 * <p>The signing key is validated at construction time, so a deployment without a
 * real {@code JWT_SECRET} fails to start instead of silently signing with a key
 * that is published in this repository (SEC-03).
 */
@Service
public class JwtService {

    /** HS256 requires a key of at least 256 bits. */
    static final int MIN_SECRET_BYTES = 32;

    /**
     * Keys that used to ship as defaults in {@code application.yml} / {@code docker-compose.yml}
     * and are therefore public knowledge. Rejected outright, even though they are long enough.
     */
    static final Set<String> BANNED_SECRETS = Set.of(
            "dev-only-not-for-production-change-me",
            "change-me",
            "changeme",
            "secret");

    private final SecretKey key;
    private final long expirationMinutes;

    public JwtService(
            @Value("${app.jwt.secret:}") String secret,
            @Value("${app.jwt.expiration-minutes}") long expirationMinutes) {
        this.key = Keys.hmacShaKeyFor(validated(secret));
        this.expirationMinutes = expirationMinutes;
    }

    /**
     * Fails closed: an absent, well-known, or too-short secret aborts startup rather than
     * letting anyone forge {@code {"sub":"u-admin","role":"ADMIN"}}.
     */
    static byte[] validated(String secret) {
        String value = secret == null ? "" : secret.trim();
        if (value.isEmpty()) {
            throw new IllegalStateException(
                    "JWT_SECRET is not set. The API refuses to start without a signing key — "
                            + "generate one with `openssl rand -base64 48` and set JWT_SECRET.");
        }
        if (BANNED_SECRETS.contains(value)) {
            throw new IllegalStateException(
                    "JWT_SECRET is set to a well-known placeholder that is published in this "
                            + "repository. Generate a real one with `openssl rand -base64 48`.");
        }
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET is too short: HS256 needs at least " + MIN_SECRET_BYTES
                            + " bytes, got " + bytes.length + ".");
        }
        return bytes;
    }

    /**
     * Issues a token for a user. {@code tokenVersion} is embedded as the {@code tv} claim so
     * logout — and any other forced sign-out — can invalidate every token already handed out
     * (SEC-09). Tokens issued before this claim existed no longer parse as valid sessions.
     */
    public String generate(String userId, String role, int tokenVersion) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                .claim("role", role)
                .claim("tv", tokenVersion)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(expirationMinutes * 60)))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}

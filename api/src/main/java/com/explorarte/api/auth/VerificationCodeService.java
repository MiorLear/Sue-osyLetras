package com.explorarte.api.auth;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issues and verifies short-lived verification codes (password reset, phone OTP).
 *
 * <p>Codes are random 6-digit numbers stored per identifier with a 15-minute expiry.
 *
 * <p>SEC-04: there is deliberately <strong>no</strong> fixed "dev" code. The previous
 * {@code AUTH_DEV_OTP_CODE} was compared before any database lookup and was never bound to
 * the identifier, and {@code verify()} backs both {@code POST /auth/otp/verify} (which
 * returns a full auth token) and {@code POST /auth/reset-password} — so knowing one fixed
 * string meant signing in as, or resetting the password of, any account. It is gone, and
 * no environment variable can bring it back. To read a code while testing locally, query
 * the table directly:
 *
 * <pre>
 * docker compose exec db psql -U explorarte -d explorarte \
 *   -c "select * from verification_codes;"
 * </pre>
 */
@Service
public class VerificationCodeService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long TTL_MINUTES = 15;

    private final VerificationCodeRepository repository;
    private final int maxAttempts;

    public VerificationCodeService(
            VerificationCodeRepository repository,
            @Value("${app.auth.otp-max-attempts:5}") int maxAttempts) {
        this.repository = repository;
        this.maxAttempts = Math.max(1, maxAttempts);
    }

    /** Normalizes an identifier so issue/verify agree: emails lowercased, phones digits-only. */
    public static String normalize(String identifier) {
        if (identifier == null) {
            return "";
        }
        String trimmed = identifier.trim();
        return trimmed.contains("@") ? trimmed.toLowerCase() : trimmed.replaceAll("[^0-9]", "");
    }

    /** Generates, stores (replacing any prior code for this identifier), and returns a fresh code. */
    @Transactional
    public String issue(String identifier) {
        String key = normalize(identifier);
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        VerificationCode entity = repository.findById(key)
                .orElseGet(() -> new VerificationCode(key, code, Instant.now()));
        entity.setCode(code);
        entity.setExpiresAt(Instant.now().plus(TTL_MINUTES, ChronoUnit.MINUTES));
        // A freshly issued code starts with a clean slate; re-issuing is the documented way
        // out of a lockout, and it costs the caller a rate-limited /auth/otp/request.
        entity.setAttempts(0);
        repository.save(entity);
        return code;
    }

    /**
     * True only if the code matches the stored, non-expired code issued for this identifier.
     *
     * <p>SEC-05: every failed guess is counted and persisted, and the code is destroyed once
     * the cap is reached — so the 6-digit space cannot be walked within the 15-minute TTL.
     */
    @Transactional
    public boolean verify(String identifier, String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        VerificationCode stored = repository.findById(normalize(identifier)).orElse(null);
        if (stored == null) {
            return false;
        }
        if (!stored.getExpiresAt().isAfter(Instant.now())) {
            repository.delete(stored);
            return false;
        }
        if (stored.getCode().equals(code)) {
            return true;
        }
        stored.setAttempts(stored.getAttempts() + 1);
        if (stored.getAttempts() >= maxAttempts) {
            // Burn the code outright: a locked-out caller must request a new one.
            repository.delete(stored);
        } else {
            repository.save(stored);
        }
        return false;
    }

    /** Removes a used code (best-effort; a missing code is not an error). */
    @Transactional
    public void consume(String identifier) {
        repository.findById(normalize(identifier)).ifPresent(repository::delete);
    }
}

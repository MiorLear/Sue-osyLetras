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
 * <p>Codes are random 6-digit numbers stored per identifier with a 15-minute
 * expiry. An optional {@code app.auth.dev-otp-code} (env {@code AUTH_DEV_OTP_CODE})
 * is also accepted when set — this keeps local/dev testing convenient without SMS,
 * while production leaves it unset so there is no fixed-code backdoor.
 */
@Service
public class VerificationCodeService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long TTL_MINUTES = 15;

    private final VerificationCodeRepository repository;
    private final String devCode;

    public VerificationCodeService(
            VerificationCodeRepository repository,
            @Value("${app.auth.dev-otp-code:}") String devCode) {
        this.repository = repository;
        this.devCode = devCode == null ? "" : devCode.trim();
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
        repository.save(entity);
        return code;
    }

    /** True if the code matches a stored, non-expired code for the identifier, or the dev code. */
    @Transactional(readOnly = true)
    public boolean verify(String identifier, String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        if (!devCode.isEmpty() && devCode.equals(code)) {
            return true;
        }
        return repository.findById(normalize(identifier))
                .filter(vc -> vc.getExpiresAt().isAfter(Instant.now()))
                .map(vc -> vc.getCode().equals(code))
                .orElse(false);
    }

    /** Removes a used code (best-effort; a missing code is not an error). */
    @Transactional
    public void consume(String identifier) {
        repository.findById(normalize(identifier)).ifPresent(repository::delete);
    }
}

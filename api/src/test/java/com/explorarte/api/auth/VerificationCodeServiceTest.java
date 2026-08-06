package com.explorarte.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * SEC-04 — no fixed code is ever accepted, and a code only works for the identifier it was
 * issued to. The old {@code AUTH_DEV_OTP_CODE} branch ran before any DB lookup and was not
 * bound to the identifier, so one string unlocked every account.
 */
class VerificationCodeServiceTest {

    private InMemoryCodeRepository repository;
    private VerificationCodeService service;

    @BeforeEach
    void setUp() {
        repository = new InMemoryCodeRepository();
        service = new VerificationCodeService(repository.asRepository(), MAX_ATTEMPTS);
    }

    private static final int MAX_ATTEMPTS = 5;

    @Test
    void aCodeIsDestroyedAfterTheAllowedNumberOfFailedGuesses() {
        String real = service.issue("+503 7000 0000");
        String wrong = real.equals("000000") ? "111111" : "000000";

        for (int i = 0; i < MAX_ATTEMPTS; i++) {
            assertThat(service.verify("+503 7000 0000", wrong)).isFalse();
        }

        assertThat(repository.rows).as("the code row is gone, not just flagged").isEmpty();
        assertThat(service.verify("+503 7000 0000", real))
                .as("even the correct code stops working once locked out")
                .isFalse();
    }

    @Test
    void theAttemptCounterIsPersistedBetweenGuesses() {
        service.issue("+503 7000 0000");

        service.verify("+503 7000 0000", "000001");
        service.verify("+503 7000 0000", "000002");

        assertThat(repository.findById("50370000000").orElseThrow().getAttempts()).isEqualTo(2);
    }

    @Test
    void reissuingAFreshCodeClearsTheLockout() {
        String real = service.issue("+503 7000 0000");
        String wrong = real.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < MAX_ATTEMPTS - 1; i++) {
            service.verify("+503 7000 0000", wrong);
        }

        String reissued = service.issue("+503 7000 0000");

        assertThat(repository.findById("50370000000").orElseThrow().getAttempts()).isZero();
        assertThat(service.verify("+503 7000 0000", reissued)).isTrue();
    }

    @Test
    void aCorrectGuessIsNotCountedAgainstTheCap() {
        String real = service.issue("+503 7000 0000");

        for (int i = 0; i < MAX_ATTEMPTS + 3; i++) {
            assertThat(service.verify("+503 7000 0000", real)).isTrue();
        }
    }

    @Test
    void theOldFixedDevCodeNoLongerWorks() {
        String issued = service.issue("+503 7000 0000");

        assertThat(service.verify("+503 7000 0000", "123456"))
                .as("123456 must only work if it happens to be the code that was issued")
                .isEqualTo("123456".equals(issued));
        assertThat(service.verify("+503 7000 0000", issued)).isTrue();
    }

    @Test
    void aCodeIsBoundToTheIdentifierItWasIssuedTo() {
        String victimCode = service.issue("victima@ejemplo.com");
        service.issue("atacante@ejemplo.com");

        assertThat(service.verify("atacante@ejemplo.com", victimCode)).isFalse();
        assertThat(service.verify("victima@ejemplo.com", victimCode)).isTrue();
    }

    @Test
    void anUnknownIdentifierNeverVerifies() {
        assertThat(service.verify("nadie@ejemplo.com", "123456")).isFalse();
        assertThat(service.verify("nadie@ejemplo.com", "000000")).isFalse();
    }

    @Test
    void aBlankCodeNeverVerifies() {
        service.issue("alguien@ejemplo.com");
        assertThat(service.verify("alguien@ejemplo.com", null)).isFalse();
        assertThat(service.verify("alguien@ejemplo.com", "  ")).isFalse();
    }

    @Test
    void anExpiredCodeIsRejected() {
        String code = service.issue("alguien@ejemplo.com");
        repository.findById("alguien@ejemplo.com")
                .orElseThrow()
                .setExpiresAt(Instant.now().minus(1, ChronoUnit.MINUTES));

        assertThat(service.verify("alguien@ejemplo.com", code)).isFalse();
    }

    @Test
    void issuedCodesAreSixDigitsAndNotConstant() {
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (int i = 0; i < 25; i++) {
            String code = service.issue("rot-" + i + "@ejemplo.com");
            assertThat(code).matches("\\d{6}");
            seen.add(code);
        }
        assertThat(seen).hasSizeGreaterThan(1);
    }

    /**
     * Map-backed stand-in for the JPA repository — keeps these tests DB-free (Docker is not
     * available in this environment, so nothing here may need Postgres).
     */
    static class InMemoryCodeRepository {
        final Map<String, VerificationCode> rows = new HashMap<>();

        VerificationCodeRepository asRepository() {
            VerificationCodeRepository repo = org.mockito.Mockito.mock(VerificationCodeRepository.class);
            org.mockito.Mockito.when(repo.findById(org.mockito.ArgumentMatchers.anyString()))
                    .thenAnswer(inv -> Optional.ofNullable(rows.get(inv.<String>getArgument(0))));
            org.mockito.Mockito.when(repo.save(org.mockito.ArgumentMatchers.any(VerificationCode.class)))
                    .thenAnswer(inv -> {
                        VerificationCode entity = inv.getArgument(0);
                        rows.put(entity.getIdentifier(), entity);
                        return entity;
                    });
            org.mockito.Mockito.doAnswer(inv -> {
                rows.remove(inv.<VerificationCode>getArgument(0).getIdentifier());
                return null;
            }).when(repo).delete(org.mockito.ArgumentMatchers.any(VerificationCode.class));
            return repo;
        }

        Optional<VerificationCode> findById(String id) {
            return Optional.ofNullable(rows.get(id));
        }
    }
}

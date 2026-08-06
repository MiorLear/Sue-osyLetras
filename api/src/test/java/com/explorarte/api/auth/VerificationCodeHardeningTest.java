package com.explorarte.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * SEC-04 and SEC-05 for verification codes: no fixed code is ever accepted, a code only works
 * for the identifier it was issued to, and guessing runs out.
 *
 * <p>The old {@code AUTH_DEV_OTP_CODE} branch ran before any DB lookup and was not bound to
 * the identifier, so one string unlocked every account; and nothing counted failed guesses,
 * so six digits with a 15-minute TTL were walkable.
 *
 * <p>Named for the tickets rather than for the class, so it complements the broader
 * {@code VerificationCodeServiceTest} from the guardrails PR instead of colliding with it.
 */
class VerificationCodeHardeningTest {

    private static final int MAX_ATTEMPTS = 5;
    private static final String PHONE = "+503 7000 0000";
    private static final String PHONE_KEY = "50370000000";

    private InMemoryCodeStore store;
    private VerificationCodeService service;

    @BeforeEach
    void setUp() {
        store = new InMemoryCodeStore();
        service = new VerificationCodeService(store.asRepository(), MAX_ATTEMPTS);
    }

    private static String wrongCodeOtherThan(String issued) {
        return issued.equals("000000") ? "111111" : "000000";
    }

    // --- SEC-04 -----------------------------------------------------------

    @Test
    void theOldFixedDevCodeNoLongerWorks() {
        String issued = service.issue(PHONE);

        assertThat(service.verify(PHONE, "123456"))
                .as("123456 must only work if it happens to be the code that was issued")
                .isEqualTo("123456".equals(issued));
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
        store.find("alguien@ejemplo.com").orElseThrow()
                .setExpiresAt(Instant.now().minus(1, ChronoUnit.MINUTES));

        assertThat(service.verify("alguien@ejemplo.com", code)).isFalse();
    }

    @Test
    void issuedCodesAreSixDigitsAndNotConstant() {
        var seen = new java.util.HashSet<String>();
        for (int i = 0; i < 25; i++) {
            String code = service.issue("rot-" + i + "@ejemplo.com");
            assertThat(code).matches("\\d{6}");
            seen.add(code);
        }
        assertThat(seen).hasSizeGreaterThan(1);
    }

    // --- SEC-05 -----------------------------------------------------------

    @Test
    void aCodeIsDestroyedAfterTheAllowedNumberOfFailedGuesses() {
        String real = service.issue(PHONE);
        String wrong = wrongCodeOtherThan(real);

        for (int i = 0; i < MAX_ATTEMPTS; i++) {
            assertThat(service.verify(PHONE, wrong)).isFalse();
        }

        assertThat(store.rows).as("the code row is gone, not just flagged").isEmpty();
        assertThat(service.verify(PHONE, real))
                .as("even the correct code stops working once locked out")
                .isFalse();
    }

    /**
     * The lockout must not depend on the delete succeeding. This drives the guard directly:
     * the row is left in place with the counter at the cap, and the correct code must still
     * be refused.
     */
    @Test
    void aLockedOutCodeStaysRefusedEvenIfItsRowSurvives() {
        String real = service.issue(PHONE);
        VerificationCode row = store.find(PHONE_KEY).orElseThrow();
        row.setAttempts(MAX_ATTEMPTS);

        assertThat(service.verify(PHONE, real)).isFalse();
    }

    @Test
    void theAttemptCounterIsPersistedBetweenGuesses() {
        service.issue(PHONE);

        service.verify(PHONE, "000001");
        service.verify(PHONE, "000002");

        assertThat(store.find(PHONE_KEY).orElseThrow().getAttempts()).isEqualTo(2);
    }

    @Test
    void reissuingAFreshCodeClearsTheLockout() {
        String real = service.issue(PHONE);
        String wrong = wrongCodeOtherThan(real);
        for (int i = 0; i < MAX_ATTEMPTS - 1; i++) {
            service.verify(PHONE, wrong);
        }

        String reissued = service.issue(PHONE);

        assertThat(store.find(PHONE_KEY).orElseThrow().getAttempts()).isZero();
        assertThat(service.verify(PHONE, reissued)).isTrue();
    }

    @Test
    void aCorrectGuessIsNotCountedAgainstTheCap() {
        String real = service.issue(PHONE);

        for (int i = 0; i < MAX_ATTEMPTS + 3; i++) {
            assertThat(service.verify(PHONE, real)).isTrue();
        }
    }
}

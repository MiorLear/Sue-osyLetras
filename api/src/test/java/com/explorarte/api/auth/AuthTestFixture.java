package com.explorarte.api.auth;

import static org.mockito.Mockito.mock;

import com.explorarte.api.misc.SchoolRepository;
import com.explorarte.api.misc.SchoolService;
import com.explorarte.api.security.AuthRateLimiter;
import com.explorarte.api.security.JwtService;

/**
 * Collaborators for the auth tests.
 *
 * <p>Only <em>interfaces</em> are mocked here. Mockito's inline mock maker cannot instrument
 * concrete classes on a JDK 25 JVM — which is what some of the team runs locally even though
 * CI and Docker are on 21 — so every concrete collaborator is built for real over a mocked
 * repository. It also makes the tests more honest: the token really is signed and parsed, and
 * the password really is hashed.
 */
final class AuthTestFixture {

    /** 44 bytes, so it clears the HS256 minimum JwtService enforces. */
    static final String JWT_SECRET = "auth-hardening-test-signing-key-0123456789ab";

    private AuthTestFixture() {
    }

    static JwtService jwtService() {
        return new JwtService(JWT_SECRET, 60);
    }

    /** Disabled, so throttling is never the reason an unrelated assertion fails. */
    static AuthRateLimiter noRateLimit() {
        return new AuthRateLimiter(false, 1, 1, 1, 1, 1000);
    }

    /** No Resend API key: sends are disabled and report false, exercising the fallback path. */
    static EmailService disabledEmailService() {
        return new EmailService("", "Test <test@ejemplo.com>", new com.fasterxml.jackson.databind.ObjectMapper());
    }

    static SchoolService schoolService() {
        return new SchoolService(mock(SchoolRepository.class));
    }

    static VerificationCodeService codeService(VerificationCodeRepository repository) {
        return new VerificationCodeService(repository, 5);
    }
}

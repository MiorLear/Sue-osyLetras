package com.explorarte.api.auth;

import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.explorarte.api.misc.SchoolService;
import com.explorarte.api.security.AuthRateLimiter;
import com.explorarte.api.security.AuthenticatedUserCache;
import com.explorarte.api.security.JwtService;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

/**
 * Auth endpoints. Password reset sends a real, random, expiring code by email
 * (see {@link EmailService} / Resend). Phone OTP has no SMS provider wired yet.
 *
 * <p>No code is ever logged and there is no fixed "dev" code (SEC-04 / SEC-10) —
 * read {@code verification_codes} directly when testing locally.
 */
@RestController
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final VerificationCodeService verificationCodeService;
    private final EmailService emailService;
    private final SchoolService schoolService;
    private final AuthRateLimiter rateLimiter;
    private final AuthenticatedUserCache userCache;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            VerificationCodeService verificationCodeService,
            EmailService emailService,
            SchoolService schoolService,
            AuthRateLimiter rateLimiter,
            AuthenticatedUserCache userCache) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.verificationCodeService = verificationCodeService;
        this.emailService = emailService;
        this.schoolService = schoolService;
        this.rateLimiter = rateLimiter;
        this.userCache = userCache;
    }

    @PostMapping("/auth/login")
    public AuthResultDto login(@RequestBody LoginInput input) {
        // Per-IP throttling already happened in AuthRateLimitFilter; this second budget is
        // per account, so a distributed guessing run against one inbox is throttled too.
        rateLimiter.checkIdentifier("login", input.email());
        User user = userRepository.findByEmailIgnoreCase(input.email() == null ? "" : input.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        if (!passwordEncoder.matches(input.password() == null ? "" : input.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return authResult(user);
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResultDto register(@RequestBody RegisterInput input) {
        User user = new User();
        user.setId("u-" + UUID.randomUUID());
        user.setName(input.name());
        user.setLastname(input.lastname());
        user.setInstitucion(input.institucion());
        user.setUbicacion(input.ubicacion());
        String email = input.email() == null ? "" : input.email().trim();
        if (email.isBlank()) {
            // Phone-only registration: synthesize a unique, non-colliding email so a
            // second phone signup doesn't violate the UNIQUE constraint on an empty string.
            String base = input.phone() != null && !input.phone().isBlank()
                    ? input.phone().replaceAll("[^0-9]", "")
                    : user.getId();
            email = "tel-" + base + "@sinemail.explorarte";
        }
        user.setEmail(email);
        user.setPhone(input.phone());
        String rawPassword = input.password() == null || input.password().isBlank()
                ? UUID.randomUUID().toString()
                : input.password();
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRole(UserRole.TEACHER);
        // Registration auto-approves, matching the existing mock's behavior; the
        // admin console remains available to reject/suspend accounts afterwards.
        user.setStatus(UserStatus.APPROVED);
        userRepository.save(user);
        schoolService.addIfNew(user.getInstitucion());
        return authResult(user);
    }

    @PostMapping("/auth/otp/request")
    public SentResponse requestOtp(@RequestBody OtpRequestInput input) {
        rateLimiter.checkIdentifier("otp-request", input.phone());
        // The code is issued and stored, never logged (SEC-10): on Render the logs are
        // retained and readable from the dashboard, so an OTP written there is a credential
        // handed to anyone with dashboard access. No SMS provider is wired yet — integrate
        // one (e.g. Twilio) here; until then, read verification_codes when testing locally.
        verificationCodeService.issue(input.phone());
        return SentResponse.ok();
    }

    @PostMapping("/auth/otp/verify")
    public AuthResultDto verifyOtp(@RequestBody OtpVerifyInput input) {
        rateLimiter.checkIdentifier("otp-verify", input.phone());
        if (!verificationCodeService.verify(input.phone(), input.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid code");
        }
        User user = findByPhone(input.phone())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unknown phone"));
        verificationCodeService.consume(input.phone());
        return authResult(user);
    }

    @PostMapping("/auth/forgot-password")
    public SentResponse forgotPassword(@RequestBody ForgotPasswordInput input) {
        rateLimiter.checkIdentifier("forgot-password", input.emailOrPhone());
        // Always return sent:true regardless of whether the account exists, so this
        // endpoint can't be used to discover which emails/phones are registered.
        Optional<User> user = findByEmailOrPhone(input.emailOrPhone());
        if (user.isPresent()) {
            String code = verificationCodeService.issue(input.emailOrPhone());
            String email = user.get().getEmail();
            if (isDeliverableEmail(email)) {
                boolean sent = emailService.sendPasswordResetCode(email, code);
                if (!sent) {
                    // A delivery failure logs WHO and WHAT FAILED, never the code itself
                    // (SEC-10). Render retains these logs and shows them in the dashboard.
                    log.warn("[forgot-password] reset email to {} was not delivered", email);
                }
            } else {
                // Phone-only account (or synthesized email) and no SMS provider: nothing to
                // do but record that a code was issued.
                log.info("[forgot-password] no deliverable email for the requested account");
            }
        } else {
            log.info("[forgot-password] no account matched the request");
        }
        return SentResponse.ok();
    }

    @PostMapping("/auth/otp/check")
    public SentResponse checkOtp(@RequestBody OtpVerifyInput input) {
        rateLimiter.checkIdentifier("otp-verify", input.phone());
        // Validate the code without requiring an existing account, so the registration
        // phone step can verify before the user is created.
        if (!verificationCodeService.verify(input.phone(), input.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid code");
        }
        return SentResponse.ok();
    }

    @PostMapping("/auth/reset-password")
    public SentResponse resetPassword(@RequestBody ResetPasswordInput input) {
        rateLimiter.checkIdentifier("reset-password", input.emailOrPhone());
        if (!verificationCodeService.verify(input.emailOrPhone(), input.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid code");
        }
        if (input.newPassword() == null || input.newPassword().length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password too short");
        }
        User user = findByEmailOrPhone(input.emailOrPhone())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setPasswordHash(passwordEncoder.encode(input.newPassword()));
        // A password change must end every session opened with the old one (SEC-09).
        user.revokeIssuedTokens();
        userRepository.save(user);
        userCache.invalidate(user.getId());
        verificationCodeService.consume(input.emailOrPhone());
        return SentResponse.ok();
    }

    /**
     * Ends the caller's sessions. SEC-09: before this there was no revocation path at all —
     * a token stayed usable for its full 24 hours no matter what happened to the account.
     *
     * <p>Bumping the token version invalidates every token this account holds, on every
     * device, not just the one presenting the request.
     */
    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof String userId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        userRepository.findById(userId).ifPresent(user -> {
            user.revokeIssuedTokens();
            userRepository.save(user);
            userCache.invalidate(user.getId());
        });
    }

    private Optional<User> findByEmailOrPhone(String identifier) {
        String idf = identifier == null ? "" : identifier.trim();
        return userRepository.findByEmailIgnoreCase(idf).or(() -> findByPhone(idf));
    }

    /**
     * SCALE-02: this used to be {@code findAll().stream().filter(...)} — every user row
     * loaded into memory, on public endpoints that had no throttle. It degraded linearly
     * with user growth and was a trivial denial-of-service vector.
     */
    private Optional<User> findByPhone(String phone) {
        String value = phone == null ? "" : phone.trim();
        return value.isEmpty() ? Optional.empty() : userRepository.findFirstByPhone(value);
    }

    private static boolean isDeliverableEmail(String email) {
        return email != null && email.contains("@") && !email.endsWith("@sinemail.explorarte");
    }

    /**
     * Issues a token — and only ever after {@link #requireActive(User)}. SEC-01: the admin
     * approve/reject workflow used to have no server-side effect because this was reached
     * without ever reading {@code user.getStatus()}.
     */
    private AuthResultDto authResult(User user) {
        requireActive(user);
        String token = jwtService.generate(user.getId(), user.getRole().name(), user.getTokenVersion());
        return new AuthResultDto(token, user.toDto());
    }

    /** Refuses to authenticate an account that an admin has not approved, or has rejected. */
    private static void requireActive(User user) {
        if (user.getStatus() != UserStatus.APPROVED) {
            throw new AccountNotActiveException(user.getStatus());
        }
    }
}

package com.explorarte.api.auth;

import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.explorarte.api.security.JwtService;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

/**
 * Auth endpoints. Password reset sends a real, random, expiring code by email
 * (see {@link EmailService} / Resend). Phone OTP has no SMS provider wired yet,
 * so its code is logged for dev; an optional {@code AUTH_DEV_OTP_CODE} keeps
 * local testing convenient without a fixed-code backdoor in production.
 */
@RestController
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final VerificationCodeService verificationCodeService;
    private final EmailService emailService;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            VerificationCodeService verificationCodeService,
            EmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.verificationCodeService = verificationCodeService;
        this.emailService = emailService;
    }

    @PostMapping("/auth/login")
    public AuthResultDto login(@RequestBody LoginInput input) {
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
        return authResult(user);
    }

    @PostMapping("/auth/otp/request")
    public SentResponse requestOtp(@RequestBody OtpRequestInput input) {
        String code = verificationCodeService.issue(input.phone());
        // No SMS provider is wired yet — the code is logged for dev/testing only.
        // To deliver real SMS, integrate a provider (e.g. Twilio) here.
        log.info("[otp] code for phone {} is {} (no SMS provider — dev only)", input.phone(), code);
        return SentResponse.ok();
    }

    @PostMapping("/auth/otp/verify")
    public AuthResultDto verifyOtp(@RequestBody OtpVerifyInput input) {
        if (!verificationCodeService.verify(input.phone(), input.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid code");
        }
        User user = userRepository.findAll().stream()
                .filter(u -> input.phone() != null && input.phone().equals(u.getPhone()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unknown phone"));
        verificationCodeService.consume(input.phone());
        return authResult(user);
    }

    @PostMapping("/auth/forgot-password")
    public SentResponse forgotPassword(@RequestBody ForgotPasswordInput input) {
        // Always return sent:true regardless of whether the account exists, so this
        // endpoint can't be used to discover which emails/phones are registered.
        Optional<User> user = findByEmailOrPhone(input.emailOrPhone());
        if (user.isPresent()) {
            String code = verificationCodeService.issue(input.emailOrPhone());
            String email = user.get().getEmail();
            if (isDeliverableEmail(email)) {
                boolean sent = emailService.sendPasswordResetCode(email, code);
                if (!sent) {
                    // e.g. Resend rejected the send (no verified domain yet) — log the
                    // code so testing can still proceed until a domain is configured.
                    log.warn("[forgot-password] email to {} not delivered — code {} (fallback log)", email, code);
                }
            } else {
                // Phone-only account (or synthesized email): no SMS provider, so log for dev.
                log.info("[forgot-password] no deliverable email for {} — code {} (dev only)",
                        input.emailOrPhone(), code);
            }
        } else {
            log.info("[forgot-password] no account for {}", input.emailOrPhone());
        }
        return SentResponse.ok();
    }

    @PostMapping("/auth/otp/check")
    public SentResponse checkOtp(@RequestBody OtpVerifyInput input) {
        // Validate the code without requiring an existing account, so the registration
        // phone step can verify before the user is created.
        if (!verificationCodeService.verify(input.phone(), input.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid code");
        }
        return SentResponse.ok();
    }

    @PostMapping("/auth/reset-password")
    public SentResponse resetPassword(@RequestBody ResetPasswordInput input) {
        if (!verificationCodeService.verify(input.emailOrPhone(), input.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid code");
        }
        if (input.newPassword() == null || input.newPassword().length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password too short");
        }
        User user = findByEmailOrPhone(input.emailOrPhone())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setPasswordHash(passwordEncoder.encode(input.newPassword()));
        userRepository.save(user);
        verificationCodeService.consume(input.emailOrPhone());
        return SentResponse.ok();
    }

    private Optional<User> findByEmailOrPhone(String identifier) {
        String idf = identifier == null ? "" : identifier.trim();
        return userRepository.findByEmailIgnoreCase(idf)
                .or(() -> userRepository.findAll().stream()
                        .filter(u -> idf.equals(u.getPhone()))
                        .findFirst());
    }

    private static boolean isDeliverableEmail(String email) {
        return email != null && email.contains("@") && !email.endsWith("@sinemail.explorarte");
    }

    private AuthResultDto authResult(User user) {
        String token = jwtService.generate(user.getId(), user.getRole().name());
        return new AuthResultDto(token, user.toDto());
    }
}

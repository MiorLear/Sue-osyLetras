package com.explorarte.api.auth;

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
 * OTP and forgot-password are dev-only stubs: no real SMS/email provider is
 * wired up, so the "code" is logged to the console instead of sent.
 */
@RestController
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private static final String DEV_OTP_CODE = "123456";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
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
        user.setEmail(input.email() == null ? "" : input.email());
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
        log.info("[dev-otp] code for {} is {}", input.phone(), DEV_OTP_CODE);
        return SentResponse.ok();
    }

    @PostMapping("/auth/otp/verify")
    public AuthResultDto verifyOtp(@RequestBody OtpVerifyInput input) {
        if (!DEV_OTP_CODE.equals(input.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid code");
        }
        User user = userRepository.findAll().stream()
                .filter(u -> input.phone() != null && input.phone().equals(u.getPhone()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unknown phone"));
        return authResult(user);
    }

    @PostMapping("/auth/forgot-password")
    public SentResponse forgotPassword(@RequestBody ForgotPasswordInput input) {
        log.info("[dev-forgot-password] reset requested for {}", input.emailOrPhone());
        return SentResponse.ok();
    }

    private AuthResultDto authResult(User user) {
        String token = jwtService.generate(user.getId(), user.getRole().name());
        return new AuthResultDto(token, user.toDto());
    }
}

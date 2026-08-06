package com.explorarte.api.auth;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.explorarte.api.misc.SchoolService;
import com.explorarte.api.security.AuthRateLimiter;
import com.explorarte.api.security.AuthenticatedUserCache;
import com.explorarte.api.security.JwtService;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

/**
 * SCALE-02 — the public OTP and forgot-password endpoints must not read the whole users
 * table to find one row.
 */
class AuthControllerPhoneLookupTest {

    private UserRepository userRepository;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());

        User user = new User();
        user.setId("u-test");
        user.setEmail("test@ejemplo.com");
        user.setPhone("+503 7000 0000");
        user.setRole(UserRole.TEACHER);
        user.setStatus(UserStatus.APPROVED);
        when(userRepository.findFirstByPhone("+503 7000 0000")).thenReturn(Optional.of(user));

        VerificationCodeService codes = mock(VerificationCodeService.class);
        when(codes.verify(anyString(), anyString())).thenReturn(true);
        JwtService jwtService = mock(JwtService.class);
        when(jwtService.generate(anyString(), anyString(), anyInt())).thenReturn("a.jwt.token");

        AuthController controller = new AuthController(
                userRepository,
                mock(PasswordEncoder.class),
                jwtService,
                codes,
                mock(EmailService.class),
                mock(SchoolService.class),
                new AuthRateLimiter(false, 1, 1, 1, 1, 1000),
                mock(AuthenticatedUserCache.class));
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new AuthExceptionHandler())
                .build();
    }

    @Test
    void otpVerifyFindsTheUserWithAnIndexedQuery() throws Exception {
        mvc.perform(post("/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"+503 7000 0000","code":"123456"}"""))
                .andExpect(status().isOk());

        verify(userRepository).findFirstByPhone("+503 7000 0000");
        verify(userRepository, never()).findAll();
    }

    @Test
    void forgotPasswordFindsTheUserWithAnIndexedQuery() throws Exception {
        mvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"emailOrPhone":"+503 7000 0000"}"""))
                .andExpect(status().isOk());

        verify(userRepository).findFirstByPhone("+503 7000 0000");
        verify(userRepository, never()).findAll();
    }

    @Test
    void anUnknownPhoneIsRejectedWithoutScanningTheTable() throws Exception {
        mvc.perform(post("/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"+503 9999 9999","code":"123456"}"""))
                .andExpect(status().isUnauthorized());

        verify(userRepository, never()).findAll();
    }
}

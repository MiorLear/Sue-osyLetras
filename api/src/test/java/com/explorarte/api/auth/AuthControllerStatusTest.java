package com.explorarte.api.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
 * SEC-01 — POST /auth/login must refuse a PENDING or REJECTED account server-side.
 * Before this, the block lived only in web/src/routes/Login.tsx and curl bypassed it.
 */
class AuthControllerStatusTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private JwtService jwtService;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtService = mock(JwtService.class);

        AuthController controller = new AuthController(
                userRepository,
                passwordEncoder,
                jwtService,
                mock(VerificationCodeService.class),
                mock(EmailService.class),
                mock(SchoolService.class),
                permissiveRateLimiter(),
                mock(AuthenticatedUserCache.class));

        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new AuthExceptionHandler())
                .build();

        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        when(jwtService.generate(anyString(), anyString(), org.mockito.ArgumentMatchers.anyInt())).thenReturn("a.jwt.token");
    }

    private void existingUser(UserStatus status) {
        User user = new User();
        user.setId("u-test");
        user.setName("Test");
        user.setLastname("User");
        user.setEmail("test@ejemplo.com");
        user.setPasswordHash("$2a$10$hash");
        user.setRole(UserRole.TEACHER);
        user.setStatus(status);
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.of(user));
    }

    /** Rate limiting has its own tests; here it must never be the reason a call fails. */
    private static AuthRateLimiter permissiveRateLimiter() {
        return new AuthRateLimiter(false, 1, 1, 1, 1, 1000);
    }

    private static final String BODY = """
            {"email":"test@ejemplo.com","password":"correct-horse-battery"}""";

    @Test
    void rejectedUserGets403AndNoToken() throws Exception {
        existingUser(UserStatus.REJECTED);

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_REJECTED"))
                .andExpect(jsonPath("$.accountStatus").value("rejected"))
                .andExpect(jsonPath("$.token").doesNotExist());

        verify(jwtService, never()).generate(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void pendingUserGets403WithADistinguishableCode() throws Exception {
        existingUser(UserStatus.PENDING);

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_PENDING"))
                .andExpect(jsonPath("$.accountStatus").value("pending"))
                .andExpect(jsonPath("$.token").doesNotExist());

        verify(jwtService, never()).generate(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void approvedUserStillLogsIn() throws Exception {
        existingUser(UserStatus.APPROVED);

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("a.jwt.token"))
                .andExpect(jsonPath("$.user.status").value("approved"));
    }

    @Test
    void otpLoginAlsoRefusesARejectedAccount() throws Exception {
        User user = new User();
        user.setId("u-test");
        user.setName("Test");
        user.setLastname("User");
        user.setEmail("test@ejemplo.com");
        user.setPhone("+503 7000 0000");
        user.setRole(UserRole.TEACHER);
        user.setStatus(UserStatus.REJECTED);
        when(userRepository.findFirstByPhone("+503 7000 0000")).thenReturn(Optional.of(user));

        VerificationCodeService codes = mock(VerificationCodeService.class);
        when(codes.verify(anyString(), anyString())).thenReturn(true);
        AuthController controller = new AuthController(
                userRepository, passwordEncoder, jwtService, codes,
                mock(EmailService.class), mock(SchoolService.class), permissiveRateLimiter(),
                mock(AuthenticatedUserCache.class));
        MockMvc otpMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new AuthExceptionHandler())
                .build();

        otpMvc.perform(post("/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"+503 7000 0000","code":"123456"}"""))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_REJECTED"));
    }
}

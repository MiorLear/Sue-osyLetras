package com.explorarte.api.auth;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.explorarte.api.security.AuthenticatedUserCache;
import com.explorarte.api.security.JwtService;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

/**
 * SEC-01 — POST /auth/login must refuse a PENDING or REJECTED account server-side, over HTTP,
 * with a body the client can branch on. Before this, the block lived only in
 * web/src/routes/Login.tsx and curl bypassed it.
 */
class AuthControllerStatusTest {

    private static final String PASSWORD = "correct-horse-battery";
    private static final String PHONE = "+503 7000 0000";
    private static final String LOGIN_BODY = """
            {"email":"test@ejemplo.com","password":"%s"}""".formatted(PASSWORD);

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final JwtService jwtService = AuthTestFixture.jwtService();

    private UserRepository userRepository;
    private InMemoryCodeStore codeStore;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        codeStore = new InMemoryCodeStore();

        AuthController controller = new AuthController(
                userRepository,
                passwordEncoder,
                jwtService,
                AuthTestFixture.codeService(codeStore.asRepository()),
                AuthTestFixture.disabledEmailService(),
                AuthTestFixture.schoolService(),
                AuthTestFixture.noRateLimit(),
                new AuthenticatedUserCache(userRepository, 0, 1000));

        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new AuthExceptionHandler())
                .build();
    }

    private User account(UserStatus status) {
        User user = new User();
        user.setId("u-test");
        user.setName("Test");
        user.setLastname("User");
        user.setEmail("test@ejemplo.com");
        user.setPhone(PHONE);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setRole(UserRole.TEACHER);
        user.setStatus(status);
        return user;
    }

    private void emailLoginFinds(UserStatus status) {
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.of(account(status)));
    }

    @Test
    void rejectedUserGets403AndNoToken() throws Exception {
        emailLoginFinds(UserStatus.REJECTED);

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Content-Type", "application/problem+json"))
                .andExpect(jsonPath("$.code").value("ACCOUNT_REJECTED"))
                .andExpect(jsonPath("$.accountStatus").value("rejected"))
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @Test
    void pendingUserGets403WithADistinguishableCode() throws Exception {
        emailLoginFinds(UserStatus.PENDING);

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_PENDING"))
                .andExpect(jsonPath("$.accountStatus").value("pending"))
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @Test
    void approvedUserStillLogsInAndTheTokenVerifies() throws Exception {
        emailLoginFinds(UserStatus.APPROVED);

        String body = mvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.status").value("approved"))
                .andReturn().getResponse().getContentAsString();

        String token = com.jayway.jsonpath.JsonPath.read(body, "$.token");
        var claims = jwtService.parse(token);
        org.assertj.core.api.Assertions.assertThat(claims.getSubject()).isEqualTo("u-test");
        org.assertj.core.api.Assertions.assertThat(claims.get("role", String.class)).isEqualTo("TEACHER");
    }

    @Test
    void wrongPasswordIsStill401NotAStatusLeak() throws Exception {
        emailLoginFinds(UserStatus.REJECTED);

        mvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"test@ejemplo.com","password":"la-equivocada"}"""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void otpLoginAlsoRefusesARejectedAccount() throws Exception {
        User rejected = account(UserStatus.REJECTED);
        when(userRepository.findFirstByPhone(PHONE)).thenReturn(Optional.of(rejected));
        String code = issueCodeFor(PHONE);

        mvc.perform(post("/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s","code":"%s"}""".formatted(PHONE, code)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_REJECTED"));
    }

    /** Drives the real code service so the OTP path is exercised end to end. */
    private String issueCodeFor(String phone) throws Exception {
        mvc.perform(post("/auth/otp/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s"}""".formatted(phone)))
                .andExpect(status().isOk());
        return codeStore.find(VerificationCodeService.normalize(phone)).orElseThrow().getCode();
    }
}

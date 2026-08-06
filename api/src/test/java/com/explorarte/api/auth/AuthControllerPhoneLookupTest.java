package com.explorarte.api.auth;

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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.explorarte.api.security.AuthenticatedUserCache;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

/**
 * SCALE-02 — the public OTP and forgot-password endpoints must not read the whole users table
 * to find one row.
 */
class AuthControllerPhoneLookupTest {

    private static final String PHONE = "+503 7000 0000";

    private UserRepository userRepository;
    private InMemoryCodeStore codeStore;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        codeStore = new InMemoryCodeStore();
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());

        User user = new User();
        user.setId("u-test");
        user.setEmail("test@ejemplo.com");
        user.setPhone(PHONE);
        user.setRole(UserRole.TEACHER);
        user.setStatus(UserStatus.APPROVED);
        when(userRepository.findFirstByPhone(PHONE)).thenReturn(Optional.of(user));

        AuthController controller = new AuthController(
                userRepository,
                new BCryptPasswordEncoder(),
                AuthTestFixture.jwtService(),
                AuthTestFixture.codeService(codeStore.asRepository()),
                AuthTestFixture.disabledEmailService(),
                AuthTestFixture.schoolService(),
                AuthTestFixture.noRateLimit(),
                new AuthenticatedUserCache(userRepository, 0, 1000));
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new AuthExceptionHandler())
                .build();
    }

    private String issueCodeFor(String phone) throws Exception {
        mvc.perform(post("/auth/otp/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s"}""".formatted(phone)))
                .andExpect(status().isOk());
        return codeStore.find(VerificationCodeService.normalize(phone)).orElseThrow().getCode();
    }

    @Test
    void otpVerifyFindsTheUserWithAnIndexedQuery() throws Exception {
        String code = issueCodeFor(PHONE);

        mvc.perform(post("/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s","code":"%s"}""".formatted(PHONE, code)))
                .andExpect(status().isOk());

        verify(userRepository).findFirstByPhone(PHONE);
        verify(userRepository, never()).findAll();
    }

    @Test
    void forgotPasswordFindsTheUserWithAnIndexedQuery() throws Exception {
        mvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"emailOrPhone":"%s"}""".formatted(PHONE)))
                .andExpect(status().isOk());

        verify(userRepository).findFirstByPhone(PHONE);
        verify(userRepository, never()).findAll();
    }

    @Test
    void anUnknownPhoneIsRejectedWithoutScanningTheTable() throws Exception {
        String otherPhone = "+503 9999 9999";
        String code = issueCodeFor(otherPhone);

        mvc.perform(post("/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s","code":"%s"}""".formatted(otherPhone, code)))
                .andExpect(status().isUnauthorized());

        verify(userRepository, never()).findAll();
    }
}

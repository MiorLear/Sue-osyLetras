package com.explorarte.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
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

/** SEC-09 — there is now a revocation path: logout bumps the account's token version. */
class AuthControllerLogoutTest {

    private UserRepository userRepository;
    private AuthenticatedUserCache userCache;
    private User user;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userCache = mock(AuthenticatedUserCache.class);

        user = new User();
        user.setId("u-test");
        user.setName("Test");
        user.setLastname("User");
        user.setEmail("test@ejemplo.com");
        user.setRole(UserRole.TEACHER);
        user.setStatus(UserStatus.APPROVED);
        user.setTokenVersion(2);
        when(userRepository.findById(anyString())).thenReturn(Optional.of(user));

        AuthController controller = new AuthController(
                userRepository,
                mock(PasswordEncoder.class),
                mock(JwtService.class),
                mock(VerificationCodeService.class),
                mock(EmailService.class),
                mock(SchoolService.class),
                new AuthRateLimiter(false, 1, 1, 1, 1, 1000),
                userCache);

        mvc = MockMvcBuilders.standaloneSetup(controller).build();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void logoutBumpsTheTokenVersionAndEvictsTheCachedSnapshot() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("u-test", null, java.util.List.of()));

        mvc.perform(post("/auth/logout")).andExpect(status().isNoContent());

        assertThat(user.getTokenVersion())
                .as("every token holding tv=2 must stop working")
                .isEqualTo(3);
        verify(userRepository).save(user);
        verify(userCache).invalidate("u-test");
    }

    @Test
    void logoutWithoutAnAuthenticatedCallerIs401() throws Exception {
        mvc.perform(post("/auth/logout")).andExpect(status().isUnauthorized());
    }
}

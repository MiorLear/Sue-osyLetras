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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.explorarte.api.security.AuthenticatedUserCache;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

/**
 * SEC-09 — there is now a revocation path. Logout bumps the account's token version, which is
 * what {@code JwtAuthenticationFilter} compares the {@code tv} claim against, and drops the
 * cached snapshot so the change is visible immediately rather than after the cache TTL.
 */
class AuthControllerLogoutTest {

    private UserRepository userRepository;
    private AuthenticatedUserCache userCache;
    private User user;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);

        user = new User();
        user.setId("u-test");
        user.setName("Test");
        user.setLastname("User");
        user.setEmail("test@ejemplo.com");
        user.setRole(UserRole.TEACHER);
        user.setStatus(UserStatus.APPROVED);
        user.setTokenVersion(2);
        when(userRepository.findById(anyString())).thenReturn(Optional.of(user));

        // A real cache with a long TTL: without an explicit eviction the stale snapshot would
        // survive, so this genuinely tests the invalidation rather than a mock interaction.
        userCache = new AuthenticatedUserCache(userRepository, 300, 1000);

        AuthController controller = new AuthController(
                userRepository,
                new BCryptPasswordEncoder(),
                AuthTestFixture.jwtService(),
                AuthTestFixture.codeService(new InMemoryCodeStore().asRepository()),
                AuthTestFixture.disabledEmailService(),
                AuthTestFixture.schoolService(),
                AuthTestFixture.noRateLimit(),
                userCache);

        mvc = MockMvcBuilders.standaloneSetup(controller).build();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticatedAs(String userId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, java.util.List.of()));
    }

    @Test
    void logoutBumpsTheTokenVersionAndEvictsTheCachedSnapshot() throws Exception {
        // Prime the cache with the pre-logout state.
        assertThat(userCache.find("u-test").orElseThrow().tokenVersion()).isEqualTo(2);
        authenticatedAs("u-test");

        mvc.perform(post("/auth/logout")).andExpect(status().isNoContent());

        assertThat(user.getTokenVersion())
                .as("every token holding tv=2 must stop working")
                .isEqualTo(3);
        verify(userRepository).save(user);
        assertThat(userCache.find("u-test").orElseThrow().tokenVersion())
                .as("the cached snapshot must not outlive the revocation")
                .isEqualTo(3);
    }

    @Test
    void logoutWithoutAnAuthenticatedCallerIs401() throws Exception {
        mvc.perform(post("/auth/logout")).andExpect(status().isUnauthorized());
    }
}

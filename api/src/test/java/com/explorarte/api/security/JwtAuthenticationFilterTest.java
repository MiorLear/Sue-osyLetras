package com.explorarte.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

import io.jsonwebtoken.Jwts;

/**
 * SEC-09 — the filter must re-read the account instead of trusting the token's claims, and
 * must honour revocation. BUG-15 — a signature-valid token without a {@code role} claim must
 * leave the request unauthenticated, not blow up with a 500.
 */
class JwtAuthenticationFilterTest {

    private static final String SECRET = "filter-test-signing-key-0123456789-abcdef";

    private JwtService jwtService;
    private UserRepository userRepository;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, 60);
        // Only the repository (an interface) is mocked; the cache itself is real, with a zero
        // TTL so each request re-reads. Mockito's inline mock maker cannot instrument concrete
        // classes on a JDK 25 JVM, and this is a more honest test besides.
        userRepository = mock(UserRepository.class);
        filter = new JwtAuthenticationFilter(jwtService, new AuthenticatedUserCache(userRepository, 0, 1000));
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static MockHttpServletRequest requestWith(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/posts");
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }

    private void accountIs(UserRole role, UserStatus status, int tokenVersion) {
        User user = new User();
        user.setId("u-test");
        user.setEmail("test@ejemplo.com");
        user.setRole(role);
        user.setStatus(status);
        user.setTokenVersion(tokenVersion);
        when(userRepository.findById(anyString())).thenReturn(Optional.of(user));
    }

    private void accountIsGone() {
        when(userRepository.findById(anyString())).thenReturn(Optional.empty());
    }

    private MockHttpServletResponse run(String token) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(requestWith(token), response, new MockFilterChain());
        return response;
    }

    @Test
    void authenticatesAnApprovedUserWithTheRoleFromTheDatabase() throws Exception {
        accountIs(UserRole.TEACHER, UserStatus.APPROVED, 0);
        // The token claims ADMIN; the database says TEACHER. The database must win.
        String token = jwtService.generate("u-test", "ADMIN", 0);

        run(token);

        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getPrincipal()).isEqualTo("u-test");
        assertThat(auth.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_TEACHER");
    }

    @Test
    void aRejectedAccountIsRefusedEvenWithAValidToken() throws Exception {
        accountIs(UserRole.TEACHER, UserStatus.REJECTED, 0);

        MockHttpServletResponse response = run(jwtService.generate("u-test", "TEACHER", 0));

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("ACCOUNT_REJECTED");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void aRevokedTokenNoLongerAuthenticates() throws Exception {
        // The account has since logged out: its token version moved on.
        accountIs(UserRole.TEACHER, UserStatus.APPROVED, 4);

        run(jwtService.generate("u-test", "TEACHER", 3));

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void aDeletedAccountNoLongerAuthenticates() throws Exception {
        accountIsGone();

        run(jwtService.generate("u-test", "ADMIN", 0));

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    /** BUG-15 — this used to throw a NullPointerException and surface as a 500. */
    @Test
    void aTokenWithoutARoleClaimIsRejectedWithoutBlowingUp() throws Exception {
        accountIs(UserRole.TEACHER, UserStatus.APPROVED, 0);
        String noRole = Jwts.builder()
                .subject("u-test")
                .claim("tv", 0)
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                        SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .compact();

        MockHttpServletResponse response = run(noRole);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void aTokenWithoutATokenVersionClaimIsRejected() throws Exception {
        accountIs(UserRole.ADMIN, UserStatus.APPROVED, 0);
        String legacy = Jwts.builder()
                .subject("u-test")
                .claim("role", "ADMIN")
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                        SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .compact();

        run(legacy);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void garbageAndForeignlySignedTokensAreIgnored() throws Exception {
        accountIs(UserRole.ADMIN, UserStatus.APPROVED, 0);

        run("not-a-jwt-at-all");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();

        String foreign = new JwtService("another-signing-key-0123456789-abcdefgh", 60)
                .generate("u-test", "ADMIN", 0);
        run(foreign);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void aRequestWithoutATokenPassesThroughUnauthenticated() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/emotions");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}

package com.explorarte.api.security;

import java.io.IOException;
import java.util.List;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.explorarte.api.security.AuthenticatedUserCache.Snapshot;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Reads "Authorization: Bearer &lt;token&gt;" and populates the SecurityContext — matches what
 * shared/src/api/http/index.ts already sends, so no frontend transport changes are needed.
 *
 * <p>SEC-09: a valid signature is no longer enough. The account is re-read from the database
 * (through a seconds-long cache) on every authenticated request, so role, status and
 * revocation all take effect immediately instead of at the token's 24-hour expiry.
 *
 * <p>BUG-15: a signature-valid token missing the {@code role} claim used to NPE into a 500.
 * Every claim is now checked before use, and a malformed token simply leaves the request
 * unauthenticated — 401 from {@link RestAuthenticationEntryPoint}, not a stack trace.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AuthenticatedUserCache userCache;

    public JwtAuthenticationFilter(JwtService jwtService, AuthenticatedUserCache userCache) {
        this.jwtService = jwtService;
        this.userCache = userCache;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        Snapshot user = resolve(header.substring(7));
        if (user == null) {
            // Unauthenticated, not an error: public endpoints still work, protected ones
            // answer 401 through the entry point.
            SecurityContextHolder.clearContext();
            filterChain.doFilter(request, response);
            return;
        }

        if (!user.isApproved()) {
            // The credentials are real but the account was not approved, or was rejected.
            // Answer explicitly so the client can sign the user out instead of guessing.
            SecurityContextHolder.clearContext();
            writeAccountNotActive(response, user);
            return;
        }

        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.role().name()));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user.id(), null, authorities));
        filterChain.doFilter(request, response);
    }

    /** Returns null for anything that must not authenticate the request. */
    private Snapshot resolve(String token) {
        Claims claims;
        try {
            claims = jwtService.parse(token);
        } catch (JwtException | IllegalArgumentException ex) {
            return null;
        }

        String userId = claims.getSubject();
        // BUG-15: both of these can legitimately be absent from a signature-valid token.
        Object role = claims.get("role");
        Integer tokenVersion = tokenVersionOf(claims);
        if (userId == null || userId.isBlank() || role == null || tokenVersion == null) {
            return null;
        }

        Snapshot user = userCache.find(userId).orElse(null);
        if (user == null || user.role() == null || user.status() == null) {
            // Deleted account, or a row we cannot authorize on.
            return null;
        }
        if (user.tokenVersion() != tokenVersion) {
            // Revoked: the account signed out, or its password was reset.
            return null;
        }
        return user;
    }

    private static Integer tokenVersionOf(Claims claims) {
        Object raw = claims.get("tv");
        return raw instanceof Number number ? number.intValue() : null;
    }

    private static void writeAccountNotActive(HttpServletResponse response, Snapshot user)
            throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
                "{\"detail\":\"Tu cuenta ya no tiene acceso.\",\"code\":\"ACCOUNT_"
                        + user.status().name() + "\",\"status\":\"" + user.status().toJson() + "\"}");
    }
}

package com.explorarte.api.security;

import java.io.IOException;

import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Per-IP throttling for {@code /auth/**} (SEC-05). Deliberately <em>not</em> a
 * {@code @Component}: it is instantiated by {@code SecurityConfig} so Boot does not also
 * register it in the plain servlet chain and run it twice per request.
 */
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private final AuthRateLimiter rateLimiter;

    public AuthRateLimitFilter(AuthRateLimiter rateLimiter) {
        this.rateLimiter = rateLimiter;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/auth/");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        try {
            rateLimiter.checkIp(clientIp(request));
        } catch (RateLimitExceededException ex) {
            writeTooManyRequests(response, ex);
            return;
        }
        filterChain.doFilter(request, response);
    }

    /**
     * Render (and any other reverse proxy in front of this API) terminates TLS and sets
     * X-Forwarded-For, so {@code getRemoteAddr()} alone would bucket the whole internet
     * under the proxy's address.
     */
    static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            String first = (comma < 0 ? forwarded : forwarded.substring(0, comma)).trim();
            if (!first.isEmpty()) {
                return first;
            }
        }
        return request.getRemoteAddr();
    }

    static void writeTooManyRequests(HttpServletResponse response, RateLimitExceededException ex)
            throws IOException {
        response.setStatus(429);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Retry-After", Long.toString(ex.retryAfterSeconds()));
        response.getWriter().write(
                "{\"detail\":\"" + ex.getMessage() + "\",\"code\":\"RATE_LIMITED\","
                        + "\"retryAfterSeconds\":" + ex.retryAfterSeconds() + "}");
    }
}

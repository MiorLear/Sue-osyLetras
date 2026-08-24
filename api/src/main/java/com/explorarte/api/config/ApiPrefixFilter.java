package com.explorarte.api.config;

import java.io.IOException;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Lets Firebase Hosting expose the API below {@code /api/**} without changing
 * the canonical routes used by the existing mobile and Render clients.
 * Firebase forwards the full path to Cloud Run, so this adapter removes the
 * prefix before Spring Security and MVC choose their route.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiPrefixFilter extends OncePerRequestFilter {

    private static final String PREFIX = "/api";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !(uri.equals(PREFIX) || uri.startsWith(PREFIX + "/"));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        filterChain.doFilter(new WithoutApiPrefix(request), response);
    }

    private static final class WithoutApiPrefix extends HttpServletRequestWrapper {
        private WithoutApiPrefix(HttpServletRequest request) {
            super(request);
        }

        @Override
        public String getRequestURI() {
            return strip(super.getRequestURI());
        }

        @Override
        public String getServletPath() {
            return strip(super.getServletPath());
        }

        @Override
        public String getPathInfo() {
            String pathInfo = super.getPathInfo();
            return pathInfo == null ? null : strip(pathInfo);
        }

        private static String strip(String path) {
            if (path.equals(PREFIX)) return "/";
            return path.startsWith(PREFIX + "/") ? path.substring(PREFIX.length()) : path;
        }
    }
}

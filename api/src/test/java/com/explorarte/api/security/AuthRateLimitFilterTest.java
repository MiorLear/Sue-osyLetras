package com.explorarte.api.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** SEC-05 — the filter answers 429 with Retry-After, and only guards /auth/**. */
class AuthRateLimitFilterTest {

    private static AuthRateLimitFilter filterWithCapacity(int capacity) {
        return new AuthRateLimitFilter(new AuthRateLimiter(true, capacity, 300, 1000, 300, 10_000));
    }

    private static MockHttpServletRequest post(String uri, String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        request.setRequestURI(uri);
        request.setRemoteAddr(ip);
        return request;
    }

    @Test
    void repliesWith429AndRetryAfterOnceTheBudgetIsSpent() throws Exception {
        AuthRateLimitFilter filter = filterWithCapacity(2);

        for (int i = 0; i < 2; i++) {
            MockHttpServletResponse ok = new MockHttpServletResponse();
            filter.doFilter(post("/auth/login", "203.0.113.7"), ok, new MockFilterChain());
            assertThat(ok.getStatus()).isEqualTo(200);
        }

        MockHttpServletResponse blocked = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(post("/auth/login", "203.0.113.7"), blocked, chain);

        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isNotNull();
        assertThat(blocked.getContentAsString()).contains("\"code\":\"RATE_LIMITED\"");
        assertThat(chain.getRequest()).as("the request must not reach the controller").isNull();
    }

    @Test
    void nonAuthPathsAreNotThrottled() throws Exception {
        AuthRateLimitFilter filter = filterWithCapacity(1);

        for (int i = 0; i < 10; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(post("/posts", "203.0.113.7"), response, new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(200);
        }
    }

    @Test
    void theProxyForwardedAddressIsPreferredOverTheProxyItself() {
        MockHttpServletRequest request = post("/auth/login", "10.0.0.1");
        request.addHeader("X-Forwarded-For", "203.0.113.7, 70.41.3.18");

        assertThat(AuthRateLimitFilter.clientIp(request)).isEqualTo("203.0.113.7");
        assertThat(AuthRateLimitFilter.clientIp(post("/auth/login", "10.0.0.1"))).isEqualTo("10.0.0.1");
    }
}

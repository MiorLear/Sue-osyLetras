package com.explorarte.api.config;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Render (like Heroku) injects a single DATABASE_URL in "postgresql://user:pass@host:port/db"
 * form, but Spring's datasource wants a jdbc:postgresql:// URL plus separate username/password.
 * If DATABASE_URL is present, translate it into spring.datasource.* properties before the
 * context loads. No-op locally/in docker-compose, where DATABASE_URL is never set and the
 * existing SPRING_DATASOURCE_* env vars (see application.yml) are used instead.
 *
 * <p>Also used for Supabase connection strings: the user/password are URL-decoded (Supabase
 * auto-generated passwords can contain percent-encoded special characters like %40 for '@'),
 * and any query string (e.g. ?sslmode=require) is preserved on the resulting JDBC URL instead
 * of being silently dropped.
 */
public class RenderDatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return;
        }

        URI uri = URI.create(databaseUrl.trim());
        // Render's internal connection strings for same-account services omit the port
        // (URI.getPort() returns -1 when absent) since it's always 5432 on their private network.
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://")
                .append(uri.getHost()).append(":").append(port).append(uri.getPath());
        // Keep query params (e.g. ?sslmode=require, ?pgbouncer=true) verbatim — dropping
        // them silently breaks setups that depend on them.
        String rawQuery = uri.getRawQuery();
        if (rawQuery != null && !rawQuery.isBlank()) {
            jdbcUrl.append("?").append(rawQuery);
        }

        // getUserInfo() is already RFC 3986-decoded (so a Supabase password arriving as
        // %40 becomes '@'), and unlike URLDecoder it does not turn '+' into a space. Split
        // on the first ':' only — the username never contains one, so the rest is the
        // password even if it itself contains ':'.
        String username = "";
        String password = "";
        String userInfo = uri.getUserInfo();
        if (userInfo != null && !userInfo.isEmpty()) {
            String[] parts = userInfo.split(":", 2);
            username = parts[0];
            password = parts.length > 1 ? parts[1] : "";
        }

        Map<String, Object> props = new HashMap<>();
        props.put("spring.datasource.url", jdbcUrl.toString());
        props.put("spring.datasource.username", username);
        props.put("spring.datasource.password", password);

        environment.getPropertySources().addFirst(new MapPropertySource("renderDatabaseUrl", props));
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}

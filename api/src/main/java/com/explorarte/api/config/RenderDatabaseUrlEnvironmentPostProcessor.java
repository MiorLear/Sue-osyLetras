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
 */
public class RenderDatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return;
        }

        URI uri = URI.create(databaseUrl);
        String[] userInfo = uri.getUserInfo().split(":", 2);
        String jdbcUrl = "jdbc:postgresql://" + uri.getHost() + ":" + uri.getPort() + uri.getPath();

        Map<String, Object> props = new HashMap<>();
        props.put("spring.datasource.url", jdbcUrl);
        props.put("spring.datasource.username", userInfo[0]);
        props.put("spring.datasource.password", userInfo.length > 1 ? userInfo[1] : "");

        environment.getPropertySources().addFirst(new MapPropertySource("renderDatabaseUrl", props));
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}

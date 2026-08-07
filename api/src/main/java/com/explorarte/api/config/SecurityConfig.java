package com.explorarte.api.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.explorarte.api.security.AuthRateLimitFilter;
import com.explorarte.api.security.AuthRateLimiter;
import com.explorarte.api.security.JwtAuthenticationFilter;
import com.explorarte.api.security.RestAccessDeniedHandler;
import com.explorarte.api.security.RestAuthenticationEntryPoint;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            AuthRateLimiter authRateLimiter,
            RestAuthenticationEntryPoint entryPoint,
            RestAccessDeniedHandler accessDeniedHandler) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(eh -> eh.authenticationEntryPoint(entryPoint).accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        // public reads
                        .requestMatchers(HttpMethod.GET, "/emotions", "/emotions/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/learning/topics", "/learning/topics/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/tools", "/schools").permitAll()
                        .requestMatchers(HttpMethod.GET, "/screen-intro-videos", "/screen-intro-videos/**").permitAll()
                        // GCP-04: resolving a media URL to a signed Cloud Storage URL.
                        // Reachable without a token because <img src>/<video src> cannot
                        // send an Authorization header; MediaAccessController applies the
                        // per-category rule (app.media.require-auth-for-private) itself.
                        // POST /media/upload is NOT covered by this — it falls through to
                        // anyRequest().authenticated() below.
                        .requestMatchers(HttpMethod.GET, "/media/*/*").permitAll()
                        // Must precede the /auth/** rule: logout revokes the caller's own
                        // sessions, so it needs to know who the caller is.
                        .requestMatchers(HttpMethod.POST, "/auth/logout").authenticated()
                        .requestMatchers("/auth/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                        // admin-only writes
                        .requestMatchers(HttpMethod.POST, "/emotions").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/emotions/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/emotions/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/learning/topics").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/learning/topics/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/learning/topics/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/tools").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/screen-intro-videos/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/screen-intro-videos/**").hasRole("ADMIN")
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        // everything else requires a valid token
                        .anyRequest().authenticated())
                // El orden de estas dos lineas importa, y no por el orden de los filtros.
                // addFilterBefore(f, X.class) exige que X ya este REGISTRADO en el
                // comparador de HttpSecurity, y un filtro propio solo se registra cuando se
                // agrega. Al reves —anclando el limitador contra JwtAuthenticationFilter
                // antes de haberlo agregado— Spring Security 6.3 lanza
                // "does not have a registered order" y el contexto no levanta: la API no
                // arranca en ningun entorno. Lo detecto GCP-07 corriendo la imagen de
                // produccion; ApplicationStartsTest lo cubre desde ahora.
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // SEC-05: throttle /auth/** by IP before anything else runs, so an unthrottled
                // brute force can't reach the password hasher or the code lookup at all.
                .addFilterBefore(new AuthRateLimitFilter(authRateLimiter), JwtAuthenticationFilter.class);

        return http.build();
    }

    private CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}

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
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

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

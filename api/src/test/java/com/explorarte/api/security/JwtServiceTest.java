package com.explorarte.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Date;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;

/**
 * Firma y verificación de los tokens de sesión. Test unitario puro: no levanta
 * contexto de Spring ni toca base de datos, así que corre también dentro del
 * build de Docker (ver api/Dockerfile, MAINT-02).
 *
 * <p>El tercer parámetro de {@code generate} es la versión de token de la cuenta
 * (SEC-09): viaja como claim {@code tv} y es lo que permite revocar una sesión
 * ya emitida. Aquí se pasa 0 salvo donde se comprueba precisamente eso.
 */
class JwtServiceTest {

    private static final String SECRET = "test-secret-que-debe-tener-al-menos-256-bits-de-longitud";

    private JwtService service(long expirationMinutes) {
        return new JwtService(SECRET, expirationMinutes);
    }

    @Test
    @DisplayName("el token lleva el id de usuario en el subject y el rol como claim")
    void generateCarriesSubjectAndRole() {
        Claims claims = service(60).parse(service(60).generate("u-1", "ADMIN", 0));

        assertThat(claims.getSubject()).isEqualTo("u-1");
        assertThat(claims.get("role", String.class)).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("SEC-09: el token lleva la versión de token de la cuenta como claim tv")
    void generateCarriesTokenVersion() {
        Claims claims = service(60).parse(service(60).generate("u-1", "TEACHER", 7));

        assertThat(claims.get("tv", Integer.class)).isEqualTo(7);
    }

    @Test
    @DisplayName("la expiración respeta app.jwt.expiration-minutes")
    void generateSetsExpiration() {
        Claims claims = service(60).parse(service(60).generate("u-1", "TEACHER", 0));

        long lifetimeMillis = claims.getExpiration().getTime() - claims.getIssuedAt().getTime();
        assertThat(lifetimeMillis).isEqualTo(60L * 60 * 1000);
    }

    @Test
    @DisplayName("un token firmado con otra clave no se acepta")
    void rejectsForeignSignature() {
        String foreign = new JwtService("otra-clave-igual-de-larga-para-cumplir-el-minimo-hs256", 60)
                .generate("u-1", "ADMIN", 0);

        assertThatThrownBy(() -> service(60).parse(foreign)).isInstanceOf(Exception.class);
    }

    @Test
    @DisplayName("un token caducado no se acepta")
    void rejectsExpiredToken() {
        // expiración negativa => el token nace ya vencido, sin necesidad de esperar.
        String token = service(-1).generate("u-1", "TEACHER", 0);

        assertThatThrownBy(() -> service(60).parse(token)).isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    @DisplayName("un token manipulado no se acepta")
    void rejectsTamperedToken() {
        String token = service(60).generate("u-1", "TEACHER", 0);
        String tampered = token.substring(0, token.length() - 2) + "xy";

        assertThatThrownBy(() -> service(60).parse(tampered)).isInstanceOf(Exception.class);
    }

    @Test
    @DisplayName("el issuedAt no queda en el futuro")
    void issuedAtIsNotInTheFuture() {
        Claims claims = service(60).parse(service(60).generate("u-1", "TEACHER", 0));

        assertThat(claims.getIssuedAt()).isBeforeOrEqualTo(new Date(System.currentTimeMillis() + 1000));
    }
}

package com.explorarte.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import com.explorarte.api.security.AuthRateLimiter;
import com.explorarte.api.security.JwtService;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

/**
 * Login: credenciales y estado de la cuenta.
 *
 * <p>Test unitario, sin contexto de Spring ni base de datos. Solo se mockea el
 * repositorio (una interfaz); el codificador de contraseñas y el firmador de
 * tokens son los reales, para no dar por buena una firma que no se verifica.
 * Los colaboradores que {@code login} no usa se pasan como {@code null} a
 * propósito: si algún día los usara, el test lo diría con un NPE.
 *
 * <p>Evita mockear clases concretas también por portabilidad: el mock inline de
 * Mockito 5.11 (el que trae Spring Boot 3.3.4) no puede instrumentar clases en
 * JDK 25, que es lo que corre alguien del equipo en local aunque CI y Docker
 * usen Java 21.
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerLoginTest {

    private static final String JWT_SECRET = "test-secret-que-debe-tener-al-menos-256-bits-de-longitud";

    @Mock
    private UserRepository userRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final JwtService jwtService = new JwtService(JWT_SECRET, 60);

    /**
     * Los colaboradores que {@code login} no usa siguen yendo a {@code null} a propósito.
     * El limitador es la excepción: desde SEC-05 {@code login} sí lo consulta, así que se le
     * pasa uno real y deshabilitado — el throttling tiene sus propios tests y aquí no debe
     * ser nunca el motivo de un fallo.
     */
    private AuthController controller() {
        return new AuthController(userRepository, passwordEncoder, jwtService, null, null, null,
                new AuthRateLimiter(false, 1, 1, 1, 1, 1000), null);
    }

    private User user(UserStatus status, UserRole role) {
        User u = new User();
        u.setId("u-1");
        u.setName("Ana");
        u.setEmail("ana@explorarte.org");
        u.setPasswordHash(passwordEncoder.encode("secreto-real"));
        u.setRole(role);
        u.setStatus(status);
        return u;
    }

    private static int statusOf(Throwable t) {
        assertThat(t).isInstanceOf(ResponseStatusException.class);
        return ((ResponseStatusException) t).getStatusCode().value();
    }

    @Test
    @DisplayName("un email desconocido devuelve 401")
    void unknownEmailIs401() {
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());

        Throwable thrown = catchThrowable(() -> controller().login(new LoginInput("nadie@explorarte.org", "x")));

        assertThat(statusOf(thrown)).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    @DisplayName("un email null no revienta: devuelve 401")
    void nullEmailIs401() {
        when(userRepository.findByEmailIgnoreCase("")).thenReturn(Optional.empty());

        Throwable thrown = catchThrowable(() -> controller().login(new LoginInput(null, "x")));

        assertThat(statusOf(thrown)).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    @DisplayName("una contraseña incorrecta devuelve 401")
    void wrongPasswordIs401() {
        when(userRepository.findByEmailIgnoreCase(anyString()))
                .thenReturn(Optional.of(user(UserStatus.APPROVED, UserRole.TEACHER)));

        Throwable thrown = catchThrowable(
                () -> controller().login(new LoginInput("ana@explorarte.org", "otra-cosa")));

        assertThat(statusOf(thrown)).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    @DisplayName("una contraseña null no revienta: devuelve 401")
    void nullPasswordIs401() {
        when(userRepository.findByEmailIgnoreCase(anyString()))
                .thenReturn(Optional.of(user(UserStatus.APPROVED, UserRole.TEACHER)));

        Throwable thrown = catchThrowable(() -> controller().login(new LoginInput("ana@explorarte.org", null)));

        assertThat(statusOf(thrown)).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    @DisplayName("una cuenta aprobada recibe un token verificable y su perfil")
    void approvedUserGetsToken() {
        when(userRepository.findByEmailIgnoreCase(anyString()))
                .thenReturn(Optional.of(user(UserStatus.APPROVED, UserRole.TEACHER)));

        AuthResultDto result = controller().login(new LoginInput("ana@explorarte.org", "secreto-real"));

        assertThat(result.user().id()).isEqualTo("u-1");
        assertThat(jwtService.parse(result.token()).getSubject()).isEqualTo("u-1");
        assertThat(jwtService.parse(result.token()).get("role", String.class)).isEqualTo("TEACHER");
    }

    @Test
    @DisplayName("el token lleva el rol real de la cuenta, no uno por defecto")
    void tokenCarriesRealRole() {
        when(userRepository.findByEmailIgnoreCase(anyString()))
                .thenReturn(Optional.of(user(UserStatus.APPROVED, UserRole.ADMIN)));

        AuthResultDto result = controller().login(new LoginInput("ana@explorarte.org", "secreto-real"));

        assertThat(jwtService.parse(result.token()).get("role", String.class)).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("el perfil devuelto no expone el hash de la contraseña")
    void profileDoesNotLeakPasswordHash() {
        when(userRepository.findByEmailIgnoreCase(anyString()))
                .thenReturn(Optional.of(user(UserStatus.APPROVED, UserRole.TEACHER)));

        AuthResultDto result = controller().login(new LoginInput("ana@explorarte.org", "secreto-real"));

        assertThat(result.user().toString()).doesNotContain("$2a$");
    }

    // ------------------------------------------------------------------
    // Deuda de seguridad que estos dos tests describían y que ya está cerrada
    // (SEC-01, PR #28): login exige APPROVED antes de firmar un token, así que
    // aprobar/rechazar desde el panel de administración por fin tiene efecto en
    // el servidor. Estaban @Disabled porque fallaban; ahora pasan.
    // ------------------------------------------------------------------

    @Test
    @DisplayName("SEC-01: una cuenta rechazada no puede iniciar sesión")
    void rejectedUserCannotLogIn() {
        when(userRepository.findByEmailIgnoreCase(anyString()))
                .thenReturn(Optional.of(user(UserStatus.REJECTED, UserRole.TEACHER)));

        Throwable thrown = catchThrowable(
                () -> controller().login(new LoginInput("ana@explorarte.org", "secreto-real")));

        assertThat(statusOf(thrown)).isEqualTo(HttpStatus.FORBIDDEN.value());
    }

    @Test
    @DisplayName("SEC-01: una cuenta pendiente no puede iniciar sesión")
    void pendingUserCannotLogIn() {
        when(userRepository.findByEmailIgnoreCase(anyString()))
                .thenReturn(Optional.of(user(UserStatus.PENDING, UserRole.TEACHER)));

        Throwable thrown = catchThrowable(
                () -> controller().login(new LoginInput("ana@explorarte.org", "secreto-real")));

        assertThat(statusOf(thrown)).isEqualTo(HttpStatus.FORBIDDEN.value());
    }
}

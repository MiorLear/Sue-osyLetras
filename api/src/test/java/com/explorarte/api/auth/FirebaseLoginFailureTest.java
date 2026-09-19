package com.explorarte.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.google.firebase.ErrorCode;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuthException;

/**
 * Las dos formas de no poder verificar un token, que no son la misma cosa.
 *
 * <p>Cuando a la cuenta de servicio de Cloud Run le faltó el rol de Firebase
 * Authentication, la comprobación de revocación lanzaba y con ella se caían
 * TODOS los tokens — los buenos también. Salía como 401, el cliente lo trataba
 * como sesión inválida, borraba el token y saltaba a {@code /login}: un alta
 * con Google a medio llenar se perdía, y la persona terminaba en el login
 * probando una contraseña que su cuenta nunca tuvo.
 *
 * <p>Se prueba {@code verificationFailure} y no el endpoint entero porque
 * {@code FirebaseAuth} es una clase concreta que Mockito no puede instrumentar
 * en un JDK 25, que es lo que corre parte del equipo (ver AuthTestFixture).
 * Aquí no hace falta ningún mock: la excepción se construye tal cual.
 */
class FirebaseLoginFailureTest {

    /** Sin AuthErrorCode el token ni llegó a evaluarse: el fallo es del servidor. */
    @Test
    void unPermisoQueFaltaNoSeAnunciaComoCredencialInvalida() {
        ResponseStatusException respuesta = AuthController.verificationFailure(
                new FirebaseAuthException(
                        ErrorCode.PERMISSION_DENIED, "missing firebaseauth.users.get", null, null, null));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        // Un 401 haría que el cliente borrara la sesión y saltara al login.
        assertThat(respuesta.getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);
    }

    /** Una red caída o un 5xx de Google llegan igual: vacío el AuthErrorCode. */
    @Test
    void unaCaidaDeIdentityToolkitTampoco() {
        ResponseStatusException respuesta = AuthController.verificationFailure(
                new FirebaseAuthException(ErrorCode.UNAVAILABLE, "backend unavailable", null, null, null));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    /** Con AuthErrorCode el token sí se evaluó y no vale. Eso es un 401 de verdad. */
    @Test
    void unTokenCaducadoSigueSiendoUn401() {
        ResponseStatusException respuesta = AuthController.verificationFailure(
                new FirebaseAuthException(
                        ErrorCode.INVALID_ARGUMENT, "expired", null, null, AuthErrorCode.EXPIRED_ID_TOKEN));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unTokenRevocadoTambien() {
        ResponseStatusException respuesta = AuthController.verificationFailure(
                new FirebaseAuthException(
                        ErrorCode.INVALID_ARGUMENT, "revoked", null, null, AuthErrorCode.REVOKED_ID_TOKEN));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}

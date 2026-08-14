package com.explorarte.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Códigos de verificación (OTP de teléfono y reset de contraseña). Test
 * unitario con Mockito: sin contexto de Spring y sin base de datos.
 */
@ExtendWith(MockitoExtension.class)
class VerificationCodeServiceTest {

    @Mock
    private VerificationCodeRepository repository;

    private Map<String, VerificationCode> rows;

    @BeforeEach
    void setUp() {
        rows = new HashMap<>();
    }

    /** Repositorio en memoria: findById/save contra un HashMap. */
    private void stubStore() {
        when(repository.findById(anyString())).thenAnswer(i -> Optional.ofNullable(rows.get(i.getArgument(0))));
        when(repository.save(any(VerificationCode.class))).thenAnswer(i -> {
            VerificationCode vc = i.getArgument(0);
            rows.put(vc.getIdentifier(), vc);
            return vc;
        });
    }

    /**
     * El segundo parámetro ya no es un código de dev fijo sino el número de
     * intentos fallidos permitidos (SEC-04 lo eliminó, SEC-05 añadió el tope).
     */
    private VerificationCodeService service() {
        return new VerificationCodeService(repository, MAX_ATTEMPTS);
    }

    private static final int MAX_ATTEMPTS = 5;

    /** El bloqueo destruye la fila; sin esto el almacén en memoria mentiría. */
    private void stubDelete() {
        doAnswer(i -> {
            rows.remove(i.<VerificationCode>getArgument(0).getIdentifier());
            return null;
        }).when(repository).delete(any(VerificationCode.class));
    }

    @Test
    @DisplayName("normalize pasa los emails a minúsculas")
    void normalizeLowercasesEmail() {
        assertThat(VerificationCodeService.normalize("  Ana@Explorarte.ORG ")).isEqualTo("ana@explorarte.org");
    }

    @Test
    @DisplayName("normalize deja solo los dígitos de un teléfono")
    void normalizeStripsPhoneFormatting() {
        assertThat(VerificationCodeService.normalize("+506 8888-7777")).isEqualTo("50688887777");
    }

    @Test
    @DisplayName("normalize tolera null")
    void normalizeHandlesNull() {
        assertThat(VerificationCodeService.normalize(null)).isEmpty();
    }

    @Test
    @DisplayName("issue genera un código de 6 dígitos y lo guarda normalizado")
    void issueStoresNormalizedCode() {
        stubStore();
        String code = service().issue("+506 8888-7777");

        assertThat(code).matches("\\d{6}");
        assertThat(rows).containsOnlyKeys("50688887777");
        assertThat(rows.get("50688887777").getCode()).isEqualTo(code);
    }

    @Test
    @DisplayName("verify acepta el código emitido, aunque el identificador venga con otro formato")
    void verifyAcceptsIssuedCode() {
        stubStore();
        VerificationCodeService service = service();
        String code = service.issue("+506 8888-7777");

        assertThat(service.verify("506-8888-7777", code)).isTrue();
    }

    @Test
    @DisplayName("verify rechaza un código equivocado")
    void verifyRejectsWrongCode() {
        stubStore();
        VerificationCodeService service = service();
        service.issue("50688887777");

        assertThat(service.verify("50688887777", "000000")).isFalse();
    }

    @Test
    @DisplayName("verify rechaza null y vacío sin consultar la base")
    void verifyRejectsBlankCode() {
        VerificationCodeService service = service();

        assertThat(service.verify("50688887777", null)).isFalse();
        assertThat(service.verify("50688887777", "   ")).isFalse();
    }

    @Test
    @DisplayName("verify rechaza un código caducado")
    void verifyRejectsExpiredCode() {
        when(repository.findById("50688887777")).thenReturn(Optional.of(
                new VerificationCode("50688887777", "123456", Instant.now().minus(1, ChronoUnit.MINUTES))));

        assertThat(service().verify("50688887777", "123456")).isFalse();
    }

    @Test
    @DisplayName("verify rechaza si no hay ningún código emitido")
    void verifyRejectsWhenNothingIssued() {
        when(repository.findById(anyString())).thenReturn(Optional.empty());

        assertThat(service().verify("50688887777", "123456")).isFalse();
    }

    @Test
    @DisplayName("issue reemplaza el código anterior del mismo identificador")
    void issueReplacesPreviousCode() {
        stubStore();
        VerificationCodeService service = service();
        String first = service.issue("50688887777");
        String second = service.issue("50688887777");

        assertThat(rows.get("50688887777").getCode()).isEqualTo(second);
        if (!first.equals(second)) {
            assertThat(service.verify("50688887777", first)).isFalse();
        }
    }

    // ------------------------------------------------------------------
    // Deuda de seguridad que estos tests describían y que ya está cerrada
    // (SEC-04 y SEC-05, PR #28). Estaban @Disabled porque fallaban contra el
    // código de entonces; ahora pasan y por eso están activos.
    // ------------------------------------------------------------------

    @Test
    @DisplayName("SEC-04: el código de dev no sirve para un identificador que nunca pidió código")
    void devCodeShouldBeBoundToAnIssuedIdentifier() {
        when(repository.findById(anyString())).thenReturn(Optional.empty());

        // Antes devolvía true: conocer AUTH_DEV_OTP_CODE bastaba para verificar
        // CUALQUIER cuenta, sin haber pedido nunca un código. Esa rama ya no
        // existe: no hay código fijo, ni siquiera activable por variable de entorno.
        assertThat(service().verify("victima@explorarte.org", "123456")).isFalse();
    }

    @Test
    @DisplayName("SEC-05: un código se invalida tras varios intentos fallidos")
    void codeShouldLockOutAfterFailedAttempts() {
        stubStore();
        stubDelete();
        VerificationCodeService service = service();
        String code = service.issue("50688887777");

        for (int i = 0; i < 10; i++) {
            service.verify("50688887777", String.format("%06d", i));
        }

        // Antes seguía siendo válido: 6 dígitos sin límite de intentos son
        // fuerza-brutables hasta el robo de la cuenta. Ahora el código se
        // destruye al llegar al tope y ni el correcto sirve.
        assertThat(service.verify("50688887777", code)).isFalse();
        assertThat(rows).as("la fila se borra, no se marca").isEmpty();
    }
}

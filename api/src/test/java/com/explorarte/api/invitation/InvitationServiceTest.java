package com.explorarte.api.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * El servicio de invitaciones sobre un repositorio que de verdad almacena.
 *
 * <p>{@link InvitationRepository} es una interfaz, que es lo unico que Mockito
 * puede instrumentar aqui (ver AuthTestFixture), pero se le enchufa una lista
 * detras en vez de respuestas sueltas: lo que hay que comprobar es el efecto
 * sobre las filas —que la anterior quede revocada, que el token se consuma—, y
 * eso se lee mucho peor a base de {@code verify(...)}.
 */
class InvitationServiceTest {

    private List<Invitation> rows;
    private InvitationRepository repository;
    private InvitationService service;

    @BeforeEach
    void setUp() {
        rows = new ArrayList<>();
        repository = mock(InvitationRepository.class);

        when(repository.save(any(Invitation.class))).thenAnswer(call -> {
            Invitation entity = call.getArgument(0);
            rows.removeIf(row -> row.getId().equals(entity.getId()));
            rows.add(entity);
            return entity;
        });
        when(repository.saveAll(any())).thenAnswer(call -> {
            Iterable<Invitation> entities = call.getArgument(0);
            entities.forEach(repository::save);
            return entities;
        });
        when(repository.findById(anyString())).thenAnswer(call ->
                rows.stream().filter(row -> row.getId().equals(call.getArgument(0))).findFirst());
        when(repository.findByTokenHash(anyString())).thenAnswer(call ->
                rows.stream().filter(row -> row.getTokenHash().equals(call.getArgument(0))).findFirst());
        when(repository.findByEmailIgnoreCaseAndStatus(anyString(), any())).thenAnswer(call ->
                rows.stream()
                        .filter(row -> row.getEmail().equalsIgnoreCase(call.getArgument(0))
                                && row.getStatus() == call.getArgument(1))
                        .toList());

        service = new InvitationService(repository);
    }

    private Invitation stored(String id) {
        return rows.stream().filter(row -> row.getId().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void elTokenNoSeGuardaNuncaEnClaro() {
        InvitationService.Issued issued = service.issue("docente@ejemplo.com", "u-admin");

        assertThat(issued.token()).isNotBlank();
        assertThat(issued.invitation().getTokenHash())
                .as("un volcado de la tabla no puede servir para aceptar invitaciones ajenas")
                .isNotEqualTo(issued.token())
                .hasSize(64)
                .isEqualTo(InvitationService.hash(issued.token()));
    }

    @Test
    void elCorreoSeNormalizaAlEmitir() {
        InvitationService.Issued issued = service.issue("  Docente@Ejemplo.COM  ", null);

        assertThat(issued.invitation().getEmail()).isEqualTo("docente@ejemplo.com");
    }

    @Test
    void dosTokensSeguidosNoSeRepiten() {
        assertThat(service.issue("a@b.com", null).token())
                .isNotEqualTo(service.issue("a@b.com", null).token());
    }

    @Test
    void emitirDeNuevoRevocaLaInvitacionAnteriorDeEseCorreo() {
        InvitationService.Issued primera = service.issue("docente@ejemplo.com", null);

        service.issue("docente@ejemplo.com", null);

        assertThat(stored(primera.invitation().getId()).getStatus()).isEqualTo(InvitationStatus.REVOKED);
        assertThat(service.usable(primera.token()))
                .as("dos enlaces vivos para la misma persona es uno de mas")
                .isEmpty();
    }

    @Test
    void unTokenPendienteSirveYUnoRevocadoNo() {
        InvitationService.Issued issued = service.issue("docente@ejemplo.com", null);
        assertThat(service.usable(issued.token())).isPresent();

        service.revokePendingFor("docente@ejemplo.com");

        assertThat(service.usable(issued.token())).isEmpty();
    }

    @Test
    void unaInvitacionVencidaNoSirveAunqueSigaPendienteEnLaBase() {
        InvitationService.Issued issued = service.issue("docente@ejemplo.com", null);
        Invitation row = stored(issued.invitation().getId());
        row.setExpiresAt(Instant.now().minusSeconds(1));

        assertThat(row.getStatus())
                .as("vencer no reescribe la fila: lo resuelve la lectura")
                .isEqualTo(InvitationStatus.PENDING);
        assertThat(row.effectiveStatus(Instant.now())).isEqualTo(InvitationStatus.EXPIRED);
        assertThat(service.usable(issued.token())).isEmpty();
    }

    @Test
    void aceptarLaConsumeYDejaConstanciaDeQuien() {
        InvitationService.Issued issued = service.issue("docente@ejemplo.com", "u-admin");

        Optional<Invitation> accepted = service.accept(issued.token(), "Docente@Ejemplo.com", "u-9");

        assertThat(accepted).isPresent();
        Invitation row = stored(issued.invitation().getId());
        assertThat(row.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);
        assertThat(row.getAcceptedUserId()).isEqualTo("u-9");
        assertThat(row.getAcceptedAt()).isNotNull();
        assertThat(service.usable(issued.token()))
                .as("un token solo se canjea una vez")
                .isEmpty();
    }

    /** Sin esta comprobacion, un token filtrado daria de alta cualquier
     *  direccion — que es justo lo que la invitacion pretende acotar. */
    @Test
    void aceptarConOtroCorreoNoHaceNada() {
        InvitationService.Issued issued = service.issue("docente@ejemplo.com", null);

        assertThat(service.accept(issued.token(), "otra@ejemplo.com", "u-9")).isEmpty();
        assertThat(stored(issued.invitation().getId()).getStatus()).isEqualTo(InvitationStatus.PENDING);
    }

    @Test
    void unTokenInventadoNoAbreNada() {
        service.issue("docente@ejemplo.com", null);

        assertThat(service.usable("no-es-un-token")).isEmpty();
        assertThat(service.usable("")).isEmpty();
        assertThat(service.usable(null)).isEmpty();
    }
}

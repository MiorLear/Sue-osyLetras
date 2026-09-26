package com.explorarte.api.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.explorarte.api.auth.EmailService;
import com.explorarte.api.common.ApiExceptionHandler;
import com.explorarte.api.security.CurrentUserService;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * El controlador de invitaciones con MockMvc en modo standalone.
 *
 * <p>{@link EmailService} y {@link CurrentUserService} son clases concretas, que
 * el inline mock maker no puede instrumentar en la JDK 25 que corre parte del
 * equipo (ver AuthTestFixture). Van como subclases escritas a mano: la del
 * correo ademas graba lo enviado, que es la unica forma de afirmar "se mando la
 * invitacion" sin salir a la red.
 */
class AdminInvitationControllerTest {

    /** Graba los envios en vez de llamar a Resend. */
    private static final class RecordingEmailService extends EmailService {
        private final List<String> sentTo = new ArrayList<>();
        private final List<String> tokens = new ArrayList<>();
        private boolean succeed = true;

        RecordingEmailService() {
            super("", "Test <test@ejemplo.com>", "https://explorarte.app/forgot-password",
                    "https://explorarte.app/register", new ObjectMapper());
        }

        @Override
        public boolean sendInvitation(String toEmail, String token) {
            if (!succeed) return false;
            sentTo.add(toEmail);
            tokens.add(token);
            return true;
        }
    }

    private static final class StubCurrentUser extends CurrentUserService {
        StubCurrentUser() {
            super(null);
        }

        @Override
        public String currentUserId() {
            return "u-admin";
        }
    }

    private List<Invitation> rows;
    private InvitationRepository invitationRepository;
    private UserRepository userRepository;
    private RecordingEmailService email;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        rows = new ArrayList<>();
        invitationRepository = mock(InvitationRepository.class);
        userRepository = mock(UserRepository.class);
        email = new RecordingEmailService();

        when(invitationRepository.save(any(Invitation.class))).thenAnswer(call -> {
            Invitation entity = call.getArgument(0);
            rows.removeIf(row -> row.getId().equals(entity.getId()));
            rows.add(entity);
            return entity;
        });
        when(invitationRepository.saveAll(any())).thenAnswer(call -> {
            Iterable<Invitation> entities = call.getArgument(0);
            entities.forEach(invitationRepository::save);
            return entities;
        });
        when(invitationRepository.findById(anyString())).thenAnswer(call ->
                rows.stream().filter(row -> row.getId().equals(call.getArgument(0))).findFirst());
        when(invitationRepository.findByTokenHash(anyString())).thenAnswer(call ->
                rows.stream().filter(row -> row.getTokenHash().equals(call.getArgument(0))).findFirst());
        when(invitationRepository.findByEmailIgnoreCaseAndStatus(anyString(), any())).thenAnswer(call ->
                rows.stream()
                        .filter(row -> row.getEmail().equalsIgnoreCase(call.getArgument(0))
                                && row.getStatus() == call.getArgument(1))
                        .toList());
        when(invitationRepository.findAllByOrderByCreatedAtDesc()).thenAnswer(call ->
                rows.stream().sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt())).toList());
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());

        AdminInvitationController controller = new AdminInvitationController(
                new InvitationService(invitationRepository), invitationRepository, userRepository,
                email, new StubCurrentUser());

        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    private void postInvitation(String email) throws Exception {
        mvc.perform(post("/admin/invitations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\"}".formatted(email)))
                .andExpect(status().isCreated());
    }

    @Test
    void invitarMandaElCorreoYDevuelveLaFilaPendiente() throws Exception {
        mvc.perform(post("/admin/invitations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"Docente@Ejemplo.com\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("docente@ejemplo.com"))
                .andExpect(jsonPath("$.status").value("pending"));

        assertThat(email.sentTo).containsExactly("docente@ejemplo.com");
        assertThat(email.tokens).singleElement().asString().isNotBlank();
    }

    /** La respuesta no puede llevar el token: quien mira la consola de admin no
     *  tiene por que poder aceptar la invitacion en nombre de otra persona. */
    @Test
    void laRespuestaNoExponeElToken() throws Exception {
        mvc.perform(post("/admin/invitations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"docente@ejemplo.com\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.tokenHash").doesNotExist());
    }

    @Test
    void unCorreoMalFormadoEs400YNoManda() throws Exception {
        mvc.perform(post("/admin/invitations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"no-es-un-correo\"}"))
                .andExpect(status().isBadRequest());

        assertThat(email.sentTo).isEmpty();
    }

    @Test
    void invitarAQuienYaTieneCuentaEs409() throws Exception {
        User existing = new User();
        existing.setId("u-1");
        when(userRepository.findByEmailIgnoreCase("docente@ejemplo.com")).thenReturn(Optional.of(existing));

        mvc.perform(post("/admin/invitations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"docente@ejemplo.com\"}"))
                .andExpect(status().isConflict());

        assertThat(email.sentTo).isEmpty();
    }

    /**
     * Si el correo no sale, la invitacion no puede quedarse pendiente: la lista
     * mostraria un enlace que nadie recibio y nada distinguiria un caso del otro.
     */
    @Test
    void siElEnvioFallaLaInvitacionNoQuedaPendiente() throws Exception {
        email.succeed = false;

        mvc.perform(post("/admin/invitations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"docente@ejemplo.com\"}"))
                .andExpect(status().isServiceUnavailable());

        assertThat(rows).allSatisfy(row ->
                assertThat(row.getStatus()).isEqualTo(InvitationStatus.REVOKED));
    }

    @Test
    void laListaDevuelveLoEmitido() throws Exception {
        postInvitation("una@ejemplo.com");
        postInvitation("otra@ejemplo.com");

        mvc.perform(get("/admin/invitations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void reenviarEmiteUnTokenNuevoYRevocaElAnterior() throws Exception {
        postInvitation("docente@ejemplo.com");
        String id = rows.get(0).getId();
        String primerToken = email.tokens.get(0);

        mvc.perform(post("/admin/invitations/%s/resend".formatted(id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("pending"));

        assertThat(email.tokens).hasSize(2);
        assertThat(email.tokens.get(1))
                .as("reenviar el mismo token dejaria vivo un enlace quiza ya vencido")
                .isNotEqualTo(primerToken);
        assertThat(rows.stream().filter(r -> r.getId().equals(id)).findFirst().orElseThrow().getStatus())
                .isEqualTo(InvitationStatus.REVOKED);
    }

    @Test
    void revocarLaDejaRevocadaSinBorrarla() throws Exception {
        postInvitation("docente@ejemplo.com");
        String id = rows.get(0).getId();

        mvc.perform(delete("/admin/invitations/%s".formatted(id)))
                .andExpect(status().isNoContent());

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getStatus()).isEqualTo(InvitationStatus.REVOKED);
    }

    @Test
    void unaInvitacionYaAceptadaNoSeRevocaNiSeReenvia() throws Exception {
        postInvitation("docente@ejemplo.com");
        Invitation row = rows.get(0);
        row.setStatus(InvitationStatus.ACCEPTED);
        row.setAcceptedAt(Instant.now());

        mvc.perform(delete("/admin/invitations/%s".formatted(row.getId())))
                .andExpect(status().isConflict());
        mvc.perform(post("/admin/invitations/%s/resend".formatted(row.getId())))
                .andExpect(status().isConflict());
    }

    @Test
    void unIdQueNoExisteEs404() throws Exception {
        mvc.perform(delete("/admin/invitations/inv-no-existe"))
                .andExpect(status().isNotFound());
    }
}

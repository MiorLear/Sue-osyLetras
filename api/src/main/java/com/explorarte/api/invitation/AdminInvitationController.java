package com.explorarte.api.invitation;

import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.explorarte.api.auth.EmailService;
import com.explorarte.api.common.ConflictException;
import com.explorarte.api.common.ResourceNotFoundException;
import com.explorarte.api.security.CurrentUserService;
import com.explorarte.api.user.UserRepository;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Invitaciones desde la consola de administración.
 *
 * <p>No lleva anotaciones de rol: {@code /admin/**} ya exige ADMIN en
 * {@code SecurityConfig}. La pantalla pública que canjea el token vive en
 * {@code AuthController}, fuera de este prefijo, porque quien la abre todavía
 * no tiene cuenta.
 */
@RestController
public class AdminInvitationController {

    private final InvitationService invitationService;
    private final InvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final CurrentUserService currentUserService;

    public AdminInvitationController(
            InvitationService invitationService,
            InvitationRepository invitationRepository,
            UserRepository userRepository,
            EmailService emailService,
            CurrentUserService currentUserService) {
        this.invitationService = invitationService;
        this.invitationRepository = invitationRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/admin/invitations")
    public List<InvitationDto> list() {
        Instant now = Instant.now();
        return invitationRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(invitation -> invitation.toDto(now))
                .toList();
    }

    @PostMapping("/admin/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationDto create(@Valid @RequestBody CreateInvitationInput input) {
        String email = InvitationService.normalizeEmail(input.email());
        // Invitar a quien ya tiene cuenta no es un error del servidor pero sí un
        // gesto inútil, y decirlo evita que la administradora espere un correo
        // que no va a resolver nada.
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ConflictException("Ya existe una cuenta con ese correo");
        }
        return sendFor(invitationService.issue(email, invitedBy()));
    }

    @PostMapping("/admin/invitations/{id}/resend")
    public InvitationDto resend(@PathVariable @NotBlank @Size(max = 64) String id) {
        Invitation existing = find(id);
        if (existing.getStatus() == InvitationStatus.ACCEPTED) {
            throw new ConflictException("Esa invitación ya se aceptó");
        }
        // Token nuevo y plazo nuevo: reenviar el anterior dejaría vivo un enlace
        // que quizá ya estaba vencido, y reutilizarlo impediría revocarlo luego.
        return sendFor(invitationService.issue(existing.getEmail(), invitedBy()));
    }

    @DeleteMapping("/admin/invitations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable @NotBlank @Size(max = 64) String id) {
        Invitation invitation = find(id);
        if (invitation.getStatus() == InvitationStatus.ACCEPTED) {
            throw new ConflictException("Esa invitación ya se aceptó; gestiona la cuenta desde Usuarios");
        }
        invitation.setStatus(InvitationStatus.REVOKED);
        invitationRepository.save(invitation);
    }

    /**
     * Manda el correo y devuelve la fila.
     *
     * <p>Si el envío falla, la invitación se revoca antes de contestar: dejarla
     * pendiente mostraría en la lista un enlace que nadie recibió, y la
     * administradora no tendría forma de notar la diferencia.
     */
    private InvitationDto sendFor(InvitationService.Issued issued) {
        if (!emailService.sendInvitation(issued.invitation().getEmail(), issued.token())) {
            invitationService.revokePendingFor(issued.invitation().getEmail());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "No se pudo enviar la invitación");
        }
        return issued.invitation().toDto(Instant.now());
    }

    private String invitedBy() {
        try {
            return currentUserService.currentUserId();
        } catch (RuntimeException ignored) {
            // Solo es trazabilidad: no vale la pena tumbar el envío por ella.
            return null;
        }
    }

    private Invitation find(String id) {
        return invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation"));
    }
}

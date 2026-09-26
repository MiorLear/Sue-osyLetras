package com.explorarte.api.invitation;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Emite, comprueba y consume invitaciones.
 *
 * <p>El token son 32 bytes de {@link SecureRandom} en Base64 URL-safe: entra sin
 * escapar en un enlace y su espacio es lo bastante grande como para que
 * adivinarlo no sea una estrategia. Aun así la comprobación cuelga de
 * {@code /auth/**}, que ya está limitado por IP, porque el coste de equivocarse
 * aquí es una cuenta ajena.
 */
@Service
public class InvitationService {

    /** Dos semanas: suficiente para unas vacaciones, no tanto como para que un
     *  enlace olvidado en un buzón siga abriendo cuentas meses después. */
    public static final Duration VALIDEZ = Duration.ofDays(14);

    private static final SecureRandom RANDOM = new SecureRandom();

    private final InvitationRepository invitationRepository;

    public InvitationService(InvitationRepository invitationRepository) {
        this.invitationRepository = invitationRepository;
    }

    /** El token en claro recién emitido, junto a la fila ya guardada. */
    public record Issued(Invitation invitation, String token) {}

    /**
     * Crea una invitación para {@code email} y devuelve su token en claro.
     *
     * <p>Cualquier invitación pendiente anterior para el mismo correo queda
     * revocada: dos enlaces vivos para una misma persona es una forma de que el
     * primero siga funcionando después de que alguien decidiera cambiarlo.
     */
    @Transactional
    public Issued issue(String email, String invitedBy) {
        String normalized = normalizeEmail(email);
        revokePendingFor(normalized);

        String token = newToken();
        Invitation invitation = new Invitation();
        invitation.setId("inv-" + UUID.randomUUID());
        invitation.setEmail(normalized);
        invitation.setTokenHash(hash(token));
        invitation.setStatus(InvitationStatus.PENDING);
        invitation.setInvitedBy(invitedBy);
        invitation.setCreatedAt(Instant.now());
        invitation.setExpiresAt(Instant.now().plus(VALIDEZ));
        return new Issued(invitationRepository.save(invitation), token);
    }

    /** Revoca las invitaciones pendientes que queden para ese correo. */
    @Transactional
    public void revokePendingFor(String email) {
        List<Invitation> pending =
                invitationRepository.findByEmailIgnoreCaseAndStatus(normalizeEmail(email), InvitationStatus.PENDING);
        for (Invitation old : pending) {
            old.setStatus(InvitationStatus.REVOKED);
        }
        invitationRepository.saveAll(pending);
    }

    /** La invitación que ese token abre, si sigue sirviendo. */
    public Optional<Invitation> usable(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        return invitationRepository.findByTokenHash(hash(token))
                .filter(invitation -> invitation.isUsable(Instant.now()));
    }

    /**
     * Marca la invitación como aceptada por {@code userId}.
     *
     * <p>El correo del alta tiene que ser el de la invitación. Sin esa
     * comprobación, un token filtrado serviría para dar de alta cualquier
     * dirección, que es justo lo que la invitación pretende acotar.
     */
    @Transactional
    public Optional<Invitation> accept(String token, String email, String userId) {
        Optional<Invitation> found = usable(token)
                .filter(invitation -> invitation.getEmail().equalsIgnoreCase(normalizeEmail(email)));
        found.ifPresent(invitation -> {
            invitation.setStatus(InvitationStatus.ACCEPTED);
            invitation.setAcceptedAt(Instant.now());
            invitation.setAcceptedUserId(userId);
            invitationRepository.save(invitation);
        });
        return found;
    }

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** SHA-256 en hexadecimal. Sin sal a propósito: el token ya es aleatorio de
     *  32 bytes, así que no hay diccionario que recorrer, y un hash determinista
     *  es lo que permite buscar la fila por él. */
    static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible en esta JVM", e);
        }
    }
}

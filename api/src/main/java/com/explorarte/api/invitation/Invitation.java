package com.explorarte.api.invitation;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Una invitación emitida por una administradora para que alguien cree su cuenta.
 *
 * <p>Lo que se guarda es el SHA-256 del token, no el token. El valor en claro
 * solo existe el tiempo que tarda en irse en el correo: quien lea la base de
 * datos —un volcado, un respaldo, una consulta de soporte— no puede aceptar
 * invitaciones ajenas con lo que encuentre ahí. Es el mismo criterio que sigue
 * el resto del proyecto con cualquier credencial (SEC-10).
 */
@Entity
@Table(name = "invitations")
public class Invitation {

    @Id
    private String id;

    private String email;

    @Column(name = "token_hash", unique = true, nullable = false)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    private InvitationStatus status;

    @Column(name = "invited_by")
    private String invitedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "accepted_user_id")
    private String acceptedUserId;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public InvitationStatus getStatus() { return status; }
    public void setStatus(InvitationStatus status) { this.status = status; }

    public String getInvitedBy() { return invitedBy; }
    public void setInvitedBy(String invitedBy) { this.invitedBy = invitedBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(Instant acceptedAt) { this.acceptedAt = acceptedAt; }

    public String getAcceptedUserId() { return acceptedUserId; }
    public void setAcceptedUserId(String acceptedUserId) { this.acceptedUserId = acceptedUserId; }

    /**
     * El estado tal y como debe verse ahora, que no siempre es el guardado: una
     * invitación pendiente cuya fecha ya pasó está vencida aunque la columna
     * siga diciendo {@code PENDING}.
     */
    public InvitationStatus effectiveStatus(Instant now) {
        if (status == InvitationStatus.PENDING && expiresAt != null && expiresAt.isBefore(now)) {
            return InvitationStatus.EXPIRED;
        }
        return status;
    }

    /** Solo una invitación pendiente y no vencida puede aceptarse. */
    public boolean isUsable(Instant now) {
        return effectiveStatus(now) == InvitationStatus.PENDING;
    }

    public InvitationDto toDto(Instant now) {
        return new InvitationDto(id, email, effectiveStatus(now), createdAt, expiresAt, acceptedAt);
    }
}

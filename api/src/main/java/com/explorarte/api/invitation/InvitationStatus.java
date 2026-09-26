package com.explorarte.api.invitation;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Estado de una invitación.
 *
 * <p>{@code EXPIRED} no se guarda nunca: una invitación caducada sigue siendo
 * {@code PENDING} en la base y es {@link InvitationService} quien la presenta
 * como vencida al leerla. Guardarlo obligaría a un barrido periódico que
 * reescribiera filas solo porque pasó el tiempo.
 */
public enum InvitationStatus {
    PENDING, ACCEPTED, REVOKED, EXPIRED;

    @JsonValue
    public String toJson() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static InvitationStatus fromJson(String value) {
        return InvitationStatus.valueOf(value.toUpperCase());
    }
}

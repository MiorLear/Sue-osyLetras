package com.explorarte.api.invitation;

import java.time.Instant;

/** Lo que la consola de administración necesita de una invitación. El token
 *  nunca sale por aquí: solo viaja en el correo. */
public record InvitationDto(
        String id,
        String email,
        InvitationStatus status,
        Instant createdAt,
        Instant expiresAt,
        Instant acceptedAt
) {}

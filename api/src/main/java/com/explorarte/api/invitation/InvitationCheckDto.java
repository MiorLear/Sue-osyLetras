package com.explorarte.api.invitation;

/**
 * Respuesta de la consulta publica de un token.
 *
 * <p>Cuando el token no sirve —no existe, caduco, ya se uso o se revoco— se
 * responde {@code valid:false} sin correo y sin decir cual de los cuatro es:
 * distinguirlos convertiria este endpoint en un oraculo para adivinar tokens.
 */
public record InvitationCheckDto(boolean valid, String email) {
    public static InvitationCheckDto invalid() {
        return new InvitationCheckDto(false, null);
    }
}

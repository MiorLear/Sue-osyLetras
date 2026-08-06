package com.explorarte.api.auth;

import com.explorarte.api.user.UserStatus;

/**
 * The credentials were correct but the account is not allowed to sign in — it is still
 * PENDING approval, or an admin REJECTED it.
 *
 * <p>Before SEC-01 this check existed only in the web client, so calling
 * {@code POST /auth/login} directly still returned a valid 24-hour token to a rejected
 * account. It is now enforced server-side and surfaced as a 403 whose body carries a
 * machine-readable {@code code} so the client can render the right screen.
 */
public class AccountNotActiveException extends RuntimeException {

    private final UserStatus status;

    public AccountNotActiveException(UserStatus status) {
        super(messageFor(status));
        this.status = status;
    }

    public UserStatus status() {
        return status;
    }

    /** Stable, machine-readable discriminator for the client. */
    public String code() {
        return "ACCOUNT_" + status.name();
    }

    private static String messageFor(UserStatus status) {
        return status == UserStatus.REJECTED
                ? "Tu cuenta ya no tiene acceso. Contacta a una administradora."
                : "Tu cuenta está pendiente de aprobación.";
    }
}

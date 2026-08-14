package com.explorarte.api.auth;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.explorarte.api.user.UserStatus;

/**
 * The credentials were correct but the account is not allowed to sign in — it is still
 * PENDING approval, or an admin REJECTED it.
 *
 * <p>Before SEC-01 this check existed only in the web client, so calling
 * {@code POST /auth/login} directly still returned a valid 24-hour token to a rejected
 * account. It is now enforced server-side.
 *
 * <p>Extends {@link ResponseStatusException} so the 403 holds even when nothing renders the
 * body — a caller invoking the controller method directly, or a path where the advice below
 * is not in play. {@link AuthExceptionHandler} adds the machine-readable discriminators the
 * client branches on.
 */
public class AccountNotActiveException extends ResponseStatusException {

    private final transient UserStatus status;

    public AccountNotActiveException(UserStatus status) {
        super(HttpStatus.FORBIDDEN, messageFor(status));
        this.status = status;
    }

    public UserStatus status() {
        return status;
    }

    /** Stable, machine-readable discriminator for the client. */
    public String code() {
        return "ACCOUNT_" + status.name();
    }

    /** The human-readable half, without the framework's "403 FORBIDDEN " prefix. */
    public String detail() {
        return messageFor(status);
    }

    private static String messageFor(UserStatus status) {
        return status == UserStatus.REJECTED
                ? "Tu cuenta ya no tiene acceso. Contacta a una administradora."
                : "Tu cuenta está pendiente de aprobación.";
    }
}

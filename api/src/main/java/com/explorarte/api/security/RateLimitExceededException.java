package com.explorarte.api.security;

/** Thrown when an IP or an identifier has spent its budget on {@code /auth/**} (SEC-05). */
public class RateLimitExceededException extends RuntimeException {

    private final long retryAfterSeconds;

    public RateLimitExceededException(long retryAfterSeconds) {
        super("Demasiados intentos. Espera un momento y vuelve a intentarlo.");
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    /** Seconds the caller should wait, for the {@code Retry-After} header. */
    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}

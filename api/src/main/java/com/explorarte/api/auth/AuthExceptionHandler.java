package com.explorarte.api.auth;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.explorarte.api.security.RateLimitExceededException;

/**
 * Error responses for the auth endpoints only.
 *
 * <p>Scoped to {@link AuthController} ({@code assignableTypes}) so it never competes with
 * the application-wide advice in {@code com.explorarte.api.common}, and ordered first so
 * the choice is deterministic rather than dependent on bean registration order.
 *
 * <p>Bodies are RFC 7807 {@link ProblemDetail}s, matching the shape the rest of the API
 * returns. The {@code detail} key that the existing clients read is preserved, and the
 * auth-specific discriminators travel as extension properties.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthExceptionHandler {

    /** SEC-01 — 403 with a body the client can branch on, instead of a 200 plus a token. */
    @ExceptionHandler(AccountNotActiveException.class)
    public ResponseEntity<ProblemDetail> handleAccountNotActive(AccountNotActiveException ex) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, ex.detail());
        body.setProperty("code", ex.code());
        // Named accountStatus, not status: ProblemDetail already owns a numeric `status`
        // field and a same-named extension would serialize as a duplicate JSON key.
        body.setProperty("accountStatus", ex.status().toJson());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    /**
     * SEC-07 — a rejected body comes back as a 400 naming the offending fields, not as a bare
     * 500 from the database or an opaque framework error.
     *
     * <p>Redundant once PR #26 lands: its application-wide {@code ApiExceptionHandler}
     * produces the same {@code errors} map for every controller. Kept so this branch is
     * correct on its own, and ordered explicitly so which one applies is never a coin flip.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleInvalidBody(MethodArgumentNotValidException ex) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "The request body is not valid");
        Map<String, String> errors = new LinkedHashMap<>();
        for (var error : ex.getBindingResult().getAllErrors()) {
            String field = error instanceof FieldError fieldError
                    ? fieldError.getField()
                    : error.getObjectName();
            errors.putIfAbsent(field, error.getDefaultMessage());
        }
        body.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(body);
    }

    /** SEC-05 — 429 plus Retry-After when an account's auth budget is spent. */
    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ProblemDetail> handleRateLimited(RateLimitExceededException ex) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage());
        body.setProperty("code", "RATE_LIMITED");
        body.setProperty("retryAfterSeconds", ex.retryAfterSeconds());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(ex.retryAfterSeconds()))
                .body(body);
    }
}

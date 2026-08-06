package com.explorarte.api.auth;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Error responses for the auth endpoints only.
 *
 * <p>Deliberately scoped to {@link AuthController} ({@code assignableTypes}) so it never
 * competes with the application-wide advice in {@code com.explorarte.api.common}.
 */
@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthExceptionHandler {

    /** SEC-01 — 403 with a body the client can branch on, instead of a 200 plus a token. */
    @ExceptionHandler(AccountNotActiveException.class)
    public ResponseEntity<Map<String, Object>> handleAccountNotActive(AccountNotActiveException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("detail", ex.getMessage());
        body.put("code", ex.code());
        body.put("status", ex.status().toJson());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }
}

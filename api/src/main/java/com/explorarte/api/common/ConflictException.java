package com.explorarte.api.common;

/** Thrown when a write would collide with existing data (e.g. taking an email
 * address another account already uses). Surfaces as 409 instead of letting the
 * database's unique constraint become a 500. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}

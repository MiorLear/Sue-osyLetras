package com.explorarte.api.common;

/** Thrown when an upload exceeds the size cap of the category it targets.
 * Surfaces as 413. */
public class PayloadTooLargeException extends RuntimeException {
    public PayloadTooLargeException(String message) {
        super(message);
    }
}

package com.explorarte.api.common;

/** Thrown when an upload's server-detected content type is not on the target
 * category's allowlist. Surfaces as 415. */
public class UnsupportedMediaTypeException extends RuntimeException {
    public UnsupportedMediaTypeException(String message) {
        super(message);
    }
}

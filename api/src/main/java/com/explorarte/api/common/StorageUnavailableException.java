package com.explorarte.api.common;

/** Thrown when the object store is not configured (no bucket) or refuses the
 * operation. Surfaces as 503, not 500: nothing is wrong with the request, the
 * deployment is missing {@code GCS_BUCKET} or its service account cannot reach
 * Cloud Storage. Keeps the local stack usable without any Google credentials —
 * everything works except uploading a file. */
public class StorageUnavailableException extends RuntimeException {
    public StorageUnavailableException(String message) {
        super(message);
    }

    public StorageUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}

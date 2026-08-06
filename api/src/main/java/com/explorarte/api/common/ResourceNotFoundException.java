package com.explorarte.api.common;

/** Thrown when a requested resource does not exist. The message names the
 * resource type only — never the caller-supplied id, which the old
 * {@code NoSuchElementException("Post not found: " + id)} reflected straight
 * back into the response body. Surfaces as 404. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String resource) {
        super(resource + " not found");
    }
}

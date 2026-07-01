package com.explorarte.api.common;

/** Thrown when an authenticated user doesn't own/can't act on a resource (e.g. someone else's calendar event). */
public class AccessDeniedByPolicyException extends RuntimeException {
    public AccessDeniedByPolicyException(String message) {
        super(message);
    }
}

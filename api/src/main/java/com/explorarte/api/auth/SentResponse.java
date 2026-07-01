package com.explorarte.api.auth;

public record SentResponse(boolean sent) {
    public static SentResponse ok() {
        return new SentResponse(true);
    }
}

package com.explorarte.api.user;

public record InviteSentResponse(boolean sent) {
    public static InviteSentResponse ok() {
        return new InviteSentResponse(true);
    }
}

package com.explorarte.api.user;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum UserStatus {
    PENDING, APPROVED, REJECTED;

    @JsonValue
    public String toJson() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static UserStatus fromJson(String value) {
        return UserStatus.valueOf(value.toUpperCase());
    }
}

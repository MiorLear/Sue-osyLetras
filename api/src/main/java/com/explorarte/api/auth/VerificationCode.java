package com.explorarte.api.auth;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A short-lived verification code for a single identifier (normalized email or phone). */
@Entity
@Table(name = "verification_codes")
public class VerificationCode {

    @Id
    private String identifier;

    private String code;

    @Column(name = "expires_at")
    private Instant expiresAt;

    protected VerificationCode() {
    }

    public VerificationCode(String identifier, String code, Instant expiresAt) {
        this.identifier = identifier;
        this.code = code;
        this.expiresAt = expiresAt;
    }

    public String getIdentifier() {
        return identifier;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }
}

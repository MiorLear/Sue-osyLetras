-- Password-reset / phone-verification codes.
--
-- Short-lived, single active code per identifier (a normalized email or phone).
-- Replaces the old hardcoded dev OTP (123456): codes are now random and expire,
-- and password reset actually emails the code (see EmailService / Resend).
CREATE TABLE verification_codes (
    identifier  VARCHAR(255)  PRIMARY KEY,
    code        VARCHAR(12)   NOT NULL,
    expires_at  TIMESTAMPTZ   NOT NULL
);

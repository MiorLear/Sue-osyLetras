package com.explorarte.api.auth;

import java.nio.charset.StandardCharsets;

/**
 * The single definition of what counts as an acceptable password (SEC-13 / SEC-16).
 *
 * <p>There was no policy at all: a one-character password was accepted, and a blank one was
 * silently replaced with a random UUID, leaving an account nobody could sign into.
 *
 * <p>The <em>maximum</em> is not cosmetic. BCrypt only ever considers the first 72 bytes, and
 * CVE-2025-22228 (spring-security-crypto &lt; 6.3.8 / 6.4.4) makes
 * {@code BCryptPasswordEncoder.matches()} return true for any longer password whose first 72
 * bytes match. The library is upgraded in the same change; capping the input is the belt to
 * that upgrade's braces, and it is measured in UTF-8 <em>bytes</em> because that is the unit
 * BCrypt truncates on — 72 accented characters are more than 72 bytes.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    /** BCrypt ignores everything past this many bytes. */
    public static final int MAX_BYTES = 72;

    public static final String REQUIREMENTS =
            "La contraseña debe tener al menos " + MIN_LENGTH + " caracteres y no exceder "
                    + MAX_BYTES + " bytes.";

    private PasswordPolicy() {
    }

    public static boolean isPresent(String raw) {
        return raw != null && !raw.isBlank();
    }

    /** True when the value is longer than BCrypt will actually compare. */
    public static boolean exceedsMaximum(String raw) {
        return raw != null && raw.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES;
    }

    public static boolean isAcceptable(String raw) {
        return isPresent(raw) && raw.length() >= MIN_LENGTH && !exceedsMaximum(raw);
    }
}

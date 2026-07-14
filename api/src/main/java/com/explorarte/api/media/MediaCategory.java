package com.explorarte.api.media;

/** Allowlist of upload destinations (Supabase Storage folder prefixes), so
 * MediaUploadController never writes to an arbitrary path. Also drives the
 * admin-vs-any-authenticated-user check for who may upload into each one. */
public enum MediaCategory {
    TOOLS(true),
    EMOTIONS(true),
    LEARNING(true),
    SCREEN_INTROS(true),
    POSTS(false),
    PROFILE(false);

    private final boolean adminOnly;

    MediaCategory(boolean adminOnly) {
        this.adminOnly = adminOnly;
    }

    public boolean isAdminOnly() {
        return adminOnly;
    }

    /** folder prefix used in Supabase Storage, e.g. "tools", "screen-intros" */
    public String storagePrefix() {
        return name().toLowerCase().replace('_', '-');
    }

    public static MediaCategory fromQueryParam(String value) {
        return MediaCategory.valueOf(value.toUpperCase().replace('-', '_'));
    }
}

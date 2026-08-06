package com.explorarte.api.media;

import java.util.Set;

/** Allowlist of upload destinations (Supabase Storage folder prefixes), so
 * MediaUploadController never writes to an arbitrary path. Also drives the
 * admin-vs-any-authenticated-user check for who may upload into each one, the
 * set of content types that destination accepts, and its size cap.
 *
 * <p>The bucket is public-read on the Supabase origin, so an accepted type is
 * effectively a type this project is willing to host unauthenticated. Nothing
 * a browser executes (HTML, SVG, JS) is on any list, and the non-admin
 * categories (POSTS, PROFILE) are the tightest of all. */
public enum MediaCategory {

    TOOLS(true, mb(25), union(Allowed.DOCUMENTS, Allowed.IMAGES)),
    EMOTIONS(true, mb(25), union(Allowed.DOCUMENTS, Allowed.IMAGES)),
    LEARNING(true, mb(50), union(Allowed.DOCUMENTS, Allowed.IMAGES, Allowed.VIDEO, Allowed.AUDIO)),
    SCREEN_INTROS(true, mb(50), Allowed.VIDEO),
    POSTS(false, mb(20), union(Allowed.IMAGES, Allowed.VIDEO, Set.of("application/pdf"))),
    PROFILE(false, mb(5), Allowed.IMAGES);

    /** Groups reused across categories. Kept in a nested holder because an enum
     * constant's arguments are evaluated before the enum's own static fields. */
    private static final class Allowed {
        static final Set<String> IMAGES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
        static final Set<String> VIDEO = Set.of("video/mp4", "video/quicktime", "video/webm");
        static final Set<String> AUDIO = Set.of("audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav");
        static final Set<String> DOCUMENTS = Set.of(
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    }

    private final boolean adminOnly;
    private final long maxSizeBytes;
    private final Set<String> allowedMimeTypes;

    MediaCategory(boolean adminOnly, long maxSizeBytes, Set<String> allowedMimeTypes) {
        this.adminOnly = adminOnly;
        this.maxSizeBytes = maxSizeBytes;
        this.allowedMimeTypes = allowedMimeTypes;
    }

    public boolean isAdminOnly() {
        return adminOnly;
    }

    /** Hard cap for a single upload into this category, in bytes. */
    public long maxSizeBytes() {
        return maxSizeBytes;
    }

    /** Content types this category will store, as detected server-side. */
    public Set<String> allowedMimeTypes() {
        return allowedMimeTypes;
    }

    public boolean allows(String mimeType) {
        return mimeType != null && allowedMimeTypes.contains(mimeType);
    }

    /** folder prefix used in Supabase Storage, e.g. "tools", "screen-intros" */
    public String storagePrefix() {
        return name().toLowerCase().replace('_', '-');
    }

    public static MediaCategory fromQueryParam(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("A media category is required");
        }
        try {
            return MediaCategory.valueOf(value.toUpperCase().replace('-', '_'));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown media category");
        }
    }

    private static long mb(int megabytes) {
        return (long) megabytes * 1024 * 1024;
    }

    @SafeVarargs
    private static Set<String> union(Set<String>... sets) {
        return java.util.Arrays.stream(sets).flatMap(Set::stream).collect(java.util.stream.Collectors.toUnmodifiableSet());
    }
}

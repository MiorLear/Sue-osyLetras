package com.explorarte.api.media;

import java.util.Locale;
import java.util.Set;

/** Allowlist of upload destinations (folder prefixes inside the media bucket),
 * so MediaUploadController never writes to an arbitrary path. Also drives the
 * admin-vs-any-authenticated-user check for who may upload into each one, the
 * set of content types that destination accepts, its size cap, and whether
 * reading it back should require a session.
 *
 * <p>Since GCP-04 the bucket is private: nothing here is reachable without
 * going through {@code GET /media/**}. The type allowlist still matters
 * regardless — a file this API is willing to hand out to a teacher is a file it
 * is willing to be responsible for. Nothing a browser executes (HTML, SVG, JS)
 * is on any list, and the non-admin categories (POSTS, PROFILE) are the
 * tightest of all. */
public enum MediaCategory {

    // Admin-published material. It backs endpoints that are themselves
    // permitAll (/tools, /emotions, /learning/topics, /screen-intro-videos), so
    // gating the files behind a session would be stricter than the metadata
    // that points at them.
    TOOLS(true, Visibility.PUBLIC, mb(25), union(Allowed.DOCUMENTS, Allowed.IMAGES)),
    EMOTIONS(true, Visibility.PUBLIC, mb(25), union(Allowed.DOCUMENTS, Allowed.IMAGES)),
    LEARNING(true, Visibility.PUBLIC, mb(50), union(Allowed.DOCUMENTS, Allowed.IMAGES, Allowed.VIDEO, Allowed.AUDIO)),
    SCREEN_INTROS(true, Visibility.PUBLIC, mb(50), Allowed.VIDEO),
    // Teacher-generated content. /posts is 401 without a token and /me is a
    // private profile, so these files belong behind the same door — see
    // MediaAccessController and app.media.require-auth-for-private.
    POSTS(false, Visibility.PRIVATE, mb(20), union(Allowed.IMAGES, Allowed.VIDEO, Set.of("application/pdf"))),
    PROFILE(false, Visibility.PRIVATE, mb(5), Allowed.IMAGES);

    /** Whether reading the file back may require an authenticated caller. */
    public enum Visibility { PUBLIC, PRIVATE }

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
    private final Visibility visibility;
    private final long maxSizeBytes;
    private final Set<String> allowedMimeTypes;

    MediaCategory(boolean adminOnly, Visibility visibility, long maxSizeBytes, Set<String> allowedMimeTypes) {
        this.adminOnly = adminOnly;
        this.visibility = visibility;
        this.maxSizeBytes = maxSizeBytes;
        this.allowedMimeTypes = allowedMimeTypes;
    }

    public boolean isAdminOnly() {
        return adminOnly;
    }

    public Visibility visibility() {
        return visibility;
    }

    public boolean isPrivate() {
        return visibility == Visibility.PRIVATE;
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

    /** Folder prefix inside the media bucket, e.g. "tools", "screen-intros".
     * Also the first path segment of every media URL, so it is part of the
     * public contract: changing it invalidates already-stored URLs. */
    public String storagePrefix() {
        return name().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    public static MediaCategory fromQueryParam(String value) {
        return parse(value, "Unknown media category");
    }

    /** Inverse of {@link #storagePrefix()}, for the read path. */
    public static MediaCategory fromStoragePrefix(String prefix) {
        return parse(prefix, "Unknown media category");
    }

    private static MediaCategory parse(String value, String errorMessage) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("A media category is required");
        }
        try {
            return MediaCategory.valueOf(value.toUpperCase(Locale.ROOT).replace('-', '_'));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(errorMessage);
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

package com.explorarte.api.media;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * SEC-15 — checks the URLs inside a client-supplied {@link MediaItem} before
 * they are persisted.
 *
 * <p>Attachment URLs are stored verbatim and later handed to
 * {@code Linking.openURL} on mobile and to {@code <video src>} on web, so an
 * unchecked value is a redirect/handler-abuse primitive at best and a
 * {@code javascript:} sink at worst. Every attachment must therefore be an
 * {@code https} URL on the storage origin this API itself uploads to — a
 * client cannot attach a file that did not come out of {@code /media/upload}.
 *
 * <p>The host allowlist is derived from {@code app.supabase.url}. When that is
 * unset (local dev, tests) the host check is skipped and only the scheme rule
 * applies, so development against a stub storage backend still works.
 */
@Component
public class MediaUrlPolicy {

    private final String allowedHost;

    public MediaUrlPolicy(@Value("${app.supabase.url:}") String supabaseUrl) {
        this.allowedHost = hostOf(supabaseUrl);
    }

    /** Full policy: https scheme, no embedded credentials, storage host. */
    public void checkAttachments(List<MediaItem> attachments) {
        if (attachments == null) return;
        for (MediaItem attachment : attachments) {
            if (attachment == null) {
                throw new IllegalArgumentException("An attachment entry is empty");
            }
            checkStorageUrl(attachment.url());
        }
    }

    public void checkStorageUrl(String url) {
        URI uri = requireHttps(url);
        if (allowedHost != null && !allowedHost.equalsIgnoreCase(uri.getHost())) {
            throw new IllegalArgumentException("Attachment URLs must point at this project's media storage");
        }
    }

    /**
     * Scheme-only variant, used for the profile photo. A photo lands in an
     * {@code <img src>} rather than {@code openURL}, and existing accounts may
     * still round-trip a URL stored before the storage host was pinned, so the
     * host is not enforced here — but {@code javascript:}, {@code data:},
     * {@code file:} and {@code blob:} are all still rejected.
     */
    public void checkImageUrl(String url) {
        requireHttps(url);
    }

    private URI requireHttps(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("A media URL is required");
        }
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Media URL is not a valid URL");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalArgumentException("Media URLs must use https");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException("Media URL is missing a host");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalArgumentException("Media URLs must not embed credentials");
        }
        return uri;
    }

    private static String hostOf(String configuredUrl) {
        if (configuredUrl == null || configuredUrl.isBlank()) return null;
        try {
            String host = new URI(configuredUrl.trim()).getHost();
            return host == null ? null : host.toLowerCase(Locale.ROOT);
        } catch (URISyntaxException e) {
            return null;
        }
    }
}

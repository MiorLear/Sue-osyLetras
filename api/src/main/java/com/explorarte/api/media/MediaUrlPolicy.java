package com.explorarte.api.media;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * SEC-15 — checks the URLs inside a client-supplied {@link MediaItem} before
 * they are persisted, and (GCP-04) is the single place that knows what a media
 * URL of this deployment looks like.
 *
 * <p>Attachment URLs are stored verbatim and later handed to
 * {@code Linking.openURL} on mobile and to {@code <video src>} on web, so an
 * unchecked value is a redirect/handler-abuse primitive at best and a
 * {@code javascript:} sink at worst. Every attachment must therefore be an
 * {@code https} URL on this API's own media origin — a client cannot attach a
 * file that did not come out of {@code /media/upload}.
 *
 * <p>The host allowlist is {@code app.media.public-base-url} plus anything in
 * {@code app.media.legacy-hosts}. The second one exists for the Supabase
 * cutover: while old rows still hold {@code <ref>.supabase.co} URLs, a client
 * that round-trips one of those (an edit of an old post, say) would otherwise
 * be rejected. Empty it once {@code scripts/migrate-media-urls.sql} has run and
 * nothing is left pointing at the old host.
 *
 * <p>When no base URL is configured (local dev, tests) the host check is
 * skipped and only the scheme rule applies, so development against a stub
 * storage backend still works.
 */
@Component
public class MediaUrlPolicy {

    /** Path prefix of every media URL. Shared with {@link MediaAccessController}
     * so the writer and the reader of a URL cannot drift apart. */
    public static final String MEDIA_PATH_PREFIX = "/media/";

    private final String publicBaseUrl;
    private final Set<String> allowedHosts;

    public MediaUrlPolicy(
            @Value("${app.media.public-base-url:}") String publicBaseUrl,
            @Value("${app.media.legacy-hosts:}") String legacyHosts) {
        this.publicBaseUrl = publicBaseUrl == null ? "" : trimTrailingSlash(publicBaseUrl.trim());
        Set<String> hosts = new LinkedHashSet<>();
        String primary = hostOf(this.publicBaseUrl);
        if (primary != null) {
            hosts.add(primary);
        }
        if (legacyHosts != null) {
            Arrays.stream(legacyHosts.split(","))
                    .map(String::trim)
                    .filter(host -> !host.isEmpty())
                    .map(host -> host.toLowerCase(Locale.ROOT))
                    .forEach(hosts::add);
        }
        this.allowedHosts = Set.copyOf(hosts);
    }

    /**
     * The canonical, permanent address of a stored object — what goes into the
     * database and into every {@link MediaItem}.
     *
     * <p>Deliberately unsigned and free of query parameters. See
     * {@link MediaAccessController} for why the expiring part of the URL must
     * never reach a client's cache key.
     */
    public String canonicalUrl(String objectPath) {
        return publicBaseUrl + MEDIA_PATH_PREFIX + objectPath;
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
        if (!allowedHosts.isEmpty() && !allowedHosts.contains(lower(uri.getHost()))) {
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

    private static String lower(String value) {
        return value == null ? null : value.toLowerCase(Locale.ROOT);
    }

    private static String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static String hostOf(String configuredUrl) {
        if (configuredUrl == null || configuredUrl.isBlank()) return null;
        try {
            return lower(new URI(configuredUrl.trim()).getHost());
        } catch (URISyntaxException e) {
            return null;
        }
    }
}

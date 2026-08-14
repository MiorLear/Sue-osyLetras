package com.explorarte.api.media;

import java.net.URI;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.explorarte.api.common.AccessDeniedByPolicyException;

/**
 * GCP-04 / SEC-11 — the read side of media, and the reason the offline caches
 * do not break when the storage backend hands out expiring URLs.
 *
 * <h2>The problem</h2>
 * Cloud Storage signed URLs expire (7 days maximum, 15 minutes here). A URL
 * that expires cannot be the address a file is known by:
 * <ul>
 *   <li>The PWA's media index (PR #29) keys cached files by URL and is shared
 *       across teachers on purpose. A signature in the URL would make every
 *       teacher's copy a different cache entry, and every re-sign a cache miss —
 *       the index would grow without bound and hit the network anyway.</li>
 *   <li>URLs are persisted, inside {@code posts.attachments},
 *       {@code users.photo}, {@code screen_intro_videos.video} and friends. A
 *       signature written to a database row is a row that stops working, at a
 *       date nobody wrote down.</li>
 * </ul>
 *
 * <h2>The shape</h2>
 * Two URLs, and only one of them is ever stored or cached:
 * <pre>
 * canonical (stored, permanent, no query string, no signature)
 *   https://explorarte-prod.web.app/media/posts/9f1c8e2a-.../ficha.pdf
 *          └ app.media.public-base-url ┘└──── object path in the bucket ────┘
 *
 *   GET → 302 Found, Location:
 *
 * signed (ephemeral, never stored, never a cache key)
 *   https://storage.googleapis.com/explorarte-media/posts/9f1c8e2a-.../ficha.pdf
 *     ?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=...&X-Goog-Date=...
 *     &X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=...
 * </pre>
 *
 * <h2>What this buys, in the terms the tickets ask about</h2>
 * <ul>
 *   <li><b>An already-downloaded file never breaks.</b> The bytes are on the
 *       device; there is nothing to renew. A phone offline for weeks keeps
 *       playing the video it downloaded, because expiry attaches to the fetch,
 *       not to the file. Renewal is not a background job anyone has to write —
 *       the next online fetch of the same canonical URL simply gets a fresh
 *       signature.</li>
 *   <li><b>The shared media cache never fragments.</b> Every teacher, every
 *       device and every re-fetch uses the identical canonical URL. The rotating
 *       part exists only in a redirect target that no cache is keyed on.</li>
 *   <li><b>A single file can be revoked.</b> Delete the object; this endpoint
 *       stops signing for it and answers 404 within one request. Contrast a
 *       public unguessable URL, where deleting the object leaves every CDN and
 *       browser copy live and there is no chokepoint to close.</li>
 * </ul>
 *
 * <h2>The cost, stated plainly</h2>
 * One API round trip before each media fetch (a Cloud Storage metadata read plus
 * an IAM signBlob call), instead of hitting the bucket directly. Bytes still
 * never pass through Cloud Run. The redirect is cacheable for
 * {@code app.media.redirect-cache-seconds}, which is asserted below to stay well
 * under the signature lifetime so a cached redirect can never point at a dead
 * signature.
 *
 * <h2>Authentication</h2>
 * {@code GET /media/**} is reachable without a token today, because
 * {@code <img src>} and {@code <video src>} cannot send an Authorization header
 * and both clients render attachments that way. So for now the canonical URL is
 * a capability: unguessable (a v4 UUID in the path) but not authenticated.
 * {@code app.media.require-auth-for-private} turns on a session requirement for
 * the PRIVATE categories (posts, profile) the moment the clients fetch media
 * with a token instead of assigning it to {@code src} — the switch is wired and
 * tested, it just defaults off so this change does not break screens owned by
 * other work.
 */
@RestController
public class MediaAccessController {

    private final MediaStorageClient storageClient;
    private final boolean requireAuthForPrivate;
    private final Duration redirectCacheTtl;

    public MediaAccessController(
            MediaStorageClient storageClient,
            @Value("${app.media.require-auth-for-private:false}") boolean requireAuthForPrivate,
            @Value("${app.media.redirect-cache-seconds:300}") long redirectCacheSeconds,
            @Value("${app.gcs.signed-url-ttl-seconds:900}") long signedUrlTtlSeconds) {
        this.storageClient = storageClient;
        this.requireAuthForPrivate = requireAuthForPrivate;
        // A redirect cached for longer than the signature it carries is a
        // redirect that starts sending clients to an expired URL. Fail at
        // startup rather than intermittently in production; the factor of two
        // leaves room for clock skew and a slow download start.
        if (redirectCacheSeconds * 2 > signedUrlTtlSeconds) {
            throw new IllegalStateException(
                    "app.media.redirect-cache-seconds (" + redirectCacheSeconds
                            + ") must be at most half of app.gcs.signed-url-ttl-seconds ("
                            + signedUrlTtlSeconds + ")");
        }
        this.redirectCacheTtl = Duration.ofSeconds(redirectCacheSeconds);
    }

    /**
     * Resolves a canonical media URL to a short-lived signed one.
     *
     * <p>{@code objectName} is a single path segment by construction:
     * {@code MediaUploadController.sanitize} strips everything outside
     * {@code [a-zA-Z0-9._-]}, so a slash or a {@code ..} cannot appear in a name
     * this API ever produced, and a name that does contain one simply fails to
     * match this mapping.
     */
    @GetMapping(MediaUrlPolicy.MEDIA_PATH_PREFIX + "{category}/{objectName}")
    public ResponseEntity<Void> read(@PathVariable String category, @PathVariable String objectName) {
        MediaCategory mediaCategory = MediaCategory.fromStoragePrefix(category);
        if (requireAuthForPrivate && mediaCategory.isPrivate() && !isAuthenticated()) {
            throw new AccessDeniedByPolicyException("This file requires an active session");
        }

        URI signed = storageClient.signedReadUrl(mediaCategory.storagePrefix() + "/" + objectName);

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(signed)
                // "private" keeps a shared proxy from serving one teacher's
                // signed URL to another once auth is enforced; the app-level
                // caches key on the canonical URL and are unaffected either way.
                .cacheControl(CacheControl.maxAge(redirectCacheTtl).cachePrivate())
                .build();
    }

    /** {@code permitAll} still installs an AnonymousAuthenticationToken whose
     * {@code isAuthenticated()} is true, so that check alone would let everyone
     * through — the token type is what actually distinguishes a caller. */
    private static boolean isAuthenticated() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null
                && auth.isAuthenticated()
                && !(auth instanceof AnonymousAuthenticationToken)
                && auth.getPrincipal() != null;
    }
}

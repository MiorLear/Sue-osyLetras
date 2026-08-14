package com.explorarte.api.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.explorarte.api.common.AccessDeniedByPolicyException;
import com.explorarte.api.common.ResourceNotFoundException;

/**
 * GCP-04 / SEC-11. The invariant under test is the one the offline caches
 * depend on: the URL a client keeps is stable, and the expiring URL only ever
 * appears in a Location header.
 */
class MediaAccessControllerTest {

    private static final String SIGNED =
            "https://storage.googleapis.com/explorarte-media/posts/9f1c-ficha.pdf"
                    + "?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=900&X-Goog-Signature=deadbeef";

    private final StubStorageClient storage = new StubStorageClient();

    private static class StubStorageClient implements MediaStorageClient {
        String lastRequestedPath;
        boolean objectExists = true;

        @Override
        public void upload(String objectPath, byte[] bytes, String contentType) {
            throw new UnsupportedOperationException("not used by the read path");
        }

        @Override
        public URI signedReadUrl(String objectPath) {
            this.lastRequestedPath = objectPath;
            if (!objectExists) {
                throw new ResourceNotFoundException("File");
            }
            return URI.create(SIGNED);
        }
    }

    private MediaAccessController controller(boolean requireAuthForPrivate) {
        return new MediaAccessController(storage, requireAuthForPrivate, 300, 900);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void redirectsToASignedUrlAndRebuildsTheObjectPathFromTheCategory() {
        ResponseEntity<Void> response = controller(false).read("posts", "9f1c-ficha.pdf");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation()).hasToString(SIGNED);
        assertThat(storage.lastRequestedPath).isEqualTo("posts/9f1c-ficha.pdf");
    }

    /** The underscore-to-dash mapping has to survive the round trip, or every
     * screen-intro video 404s. */
    @Test
    void resolvesAMultiWordCategoryPrefix() {
        controller(false).read("screen-intros", "9f1c-intro.mp4");

        assertThat(storage.lastRequestedPath).isEqualTo("screen-intros/9f1c-intro.mp4");
    }

    /** A cached redirect that outlives its signature sends clients to a dead
     * URL, so the relationship is enforced at construction rather than
     * discovered in production. */
    @Test
    void refusesToStartIfTheRedirectMayBeCachedLongerThanTheSignatureLives() {
        assertThatThrownBy(() -> new MediaAccessController(storage, false, 600, 900))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("redirect-cache-seconds");
    }

    @Test
    void marksTheRedirectPrivateAndBoundedWellInsideTheSignatureLifetime() {
        ResponseEntity<Void> response = controller(false).read("posts", "9f1c-ficha.pdf");

        assertThat(response.getHeaders().getCacheControl()).isEqualTo("max-age=300, private");
    }

    @Test
    void answers404ForAnObjectThatWasDeleted() {
        storage.objectExists = false;

        assertThatThrownBy(() -> controller(false).read("posts", "9f1c-ficha.pdf"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void rejectsAnUnknownCategoryWithoutLeakingTheEnum() {
        assertThatThrownBy(() -> controller(false).read("..", "x"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unknown media category");
    }

    // --- app.media.require-auth-for-private -------------------------------

    @Test
    void servesEveryCategoryUnauthenticatedWhileTheFlagIsOff() {
        anonymous();

        assertThat(controller(false).read("posts", "a-b.pdf").getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(controller(false).read("profile", "a-b.png").getStatusCode()).isEqualTo(HttpStatus.FOUND);
    }

    @Test
    void closesPrivateCategoriesToAnonymousCallersWhenTheFlagIsOn() {
        anonymous();

        assertThatThrownBy(() -> controller(true).read("posts", "a-b.pdf"))
                .isInstanceOf(AccessDeniedByPolicyException.class);
        assertThatThrownBy(() -> controller(true).read("profile", "a-b.png"))
                .isInstanceOf(AccessDeniedByPolicyException.class);
    }

    /** Admin-published material stays open even with the flag on: the endpoints
     * that hand out its URLs (/tools, /emotions, /learning/topics,
     * /screen-intro-videos) are permitAll themselves. */
    @Test
    void keepsPublicCategoriesOpenEvenWhenTheFlagIsOn() {
        anonymous();

        assertThat(controller(true).read("tools", "a-b.pdf").getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(controller(true).read("learning", "a-b.mp4").getStatusCode()).isEqualTo(HttpStatus.FOUND);
    }

    @Test
    void letsAnAuthenticatedCallerThroughWhenTheFlagIsOn() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("u-1", null, List.of(new SimpleGrantedAuthority("ROLE_TEACHER"))));

        assertThat(controller(true).read("posts", "a-b.pdf").getStatusCode()).isEqualTo(HttpStatus.FOUND);
    }

    /** permitAll installs an anonymous token that reports isAuthenticated() ==
     * true; treating that as a session would make the flag a no-op. */
    private void anonymous() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "key", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));
    }
}

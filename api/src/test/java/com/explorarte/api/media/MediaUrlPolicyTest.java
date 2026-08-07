package com.explorarte.api.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

class MediaUrlPolicyTest {

    private final MediaUrlPolicy pinned = new MediaUrlPolicy("https://explorarte-prod.web.app", "");
    private final MediaUrlPolicy unconfigured = new MediaUrlPolicy("", "");

    private static MediaItem attachment(String url) {
        return new MediaItem("id-1", "archivo.pdf", url, "application/pdf", 10);
    }

    @Test
    void acceptsAUrlOnTheConfiguredStorageHost() {
        assertThatCode(() -> pinned.checkAttachments(
                List.of(attachment("https://explorarte-prod.web.app/media/posts/9f1c-x.pdf"))))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsAUrlOnAnyOtherHost() {
        assertThatThrownBy(() -> pinned.checkAttachments(List.of(attachment("https://evil.example/x.pdf"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("media storage");
    }

    /** SEC-15: these are the values that turn Linking.openURL / <video src>
     * into a sink. None of them survive, configured host or not. */
    @Test
    void rejectsNonHttpsSchemes() {
        for (String url : List.of(
                "javascript:alert(1)",
                "data:text/html;base64,PHNjcmlwdD4=",
                "file:///etc/passwd",
                "http://explorarte-prod.web.app/media/posts/x.pdf",
                "blob:https://explorarte-prod.web.app/uuid")) {
            assertThatThrownBy(() -> unconfigured.checkAttachments(List.of(attachment(url))))
                    .as("url %s", url)
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void rejectsEmbeddedCredentialsAndMissingHosts() {
        assertThatThrownBy(() -> unconfigured.checkStorageUrl("https://user:pass@explorarte-prod.web.app/x.pdf"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("credentials");
        assertThatThrownBy(() -> unconfigured.checkStorageUrl("https:///x.pdf"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> unconfigured.checkStorageUrl("   "))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> unconfigured.checkStorageUrl("https://exa mple.com/ x"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** The local default for app.media.public-base-url is http://localhost:8000,
     * so the API's own canonical URLs have to survive its own policy. Loopback
     * only: a plaintext URL on any routable host is still refused. */
    @Test
    void allowsPlainHttpOnLoopbackOnly() {
        MediaUrlPolicy local = new MediaUrlPolicy("http://localhost:8000", "");

        assertThatCode(() -> local.checkStorageUrl("http://localhost:8000/media/posts/9f1c-x.pdf"))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> unconfigured.checkStorageUrl("http://192.168.1.23:8000/media/posts/x.pdf"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("https");
    }

    @Test
    void skipsTheHostCheckWhenStorageIsNotConfigured() {
        assertThatCode(() -> unconfigured.checkAttachments(List.of(attachment("https://localhost:9000/x.pdf"))))
                .doesNotThrowAnyException();
    }

    @Test
    void toleratesNoAttachmentsButNotANullEntry() {
        assertThatCode(() -> pinned.checkAttachments(null)).doesNotThrowAnyException();
        assertThatCode(() -> pinned.checkAttachments(List.of())).doesNotThrowAnyException();
        assertThatThrownBy(() -> pinned.checkAttachments(Arrays.asList((MediaItem) null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** The photo variant deliberately keeps the scheme rule and drops the host
     * rule, so an account with a legacy photo URL can still save its profile. */
    @Test
    void imageUrlsKeepTheSchemeRuleOnly() {
        assertThatCode(() -> pinned.checkImageUrl("https://legacy.example/avatar.png")).doesNotThrowAnyException();
        assertThatThrownBy(() -> pinned.checkImageUrl("javascript:alert(1)"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // --- GCP-04 -----------------------------------------------------------

    /** The exact shape other work builds on: origin + /media/ + object path,
     * no query string, nothing that expires. */
    @Test
    void buildsACanonicalUrlWithNoQueryString() {
        String url = pinned.canonicalUrl("posts/9f1c8e2a-0000-4000-8000-000000000000-ficha.pdf");

        assertThat(url).isEqualTo(
                "https://explorarte-prod.web.app/media/posts/9f1c8e2a-0000-4000-8000-000000000000-ficha.pdf");
        assertThat(url).doesNotContain("?").doesNotContain("X-Goog-Signature");
    }

    @Test
    void toleratesATrailingSlashInTheConfiguredBaseUrl() {
        assertThat(new MediaUrlPolicy("https://explorarte-prod.web.app/", "").canonicalUrl("profile/a-b.png"))
                .isEqualTo("https://explorarte-prod.web.app/media/profile/a-b.png");
    }

    /** Cutover window: rows written before the migration still name the old
     * Supabase host, and re-saving one of those posts must not 400. */
    @Test
    void acceptsALegacyHostWhileTheSupabaseUrlsAreStillInTheDatabase() {
        MediaUrlPolicy duringCutover =
                new MediaUrlPolicy("https://explorarte-prod.web.app", "abc123.supabase.co, OTHER.example");

        assertThatCode(() -> duringCutover.checkStorageUrl(
                "https://abc123.supabase.co/storage/v1/object/public/explorarte-media/posts/x.pdf"))
                .doesNotThrowAnyException();
        assertThatCode(() -> duringCutover.checkStorageUrl("https://other.example/x.pdf"))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> duringCutover.checkStorageUrl("https://evil.example/x.pdf"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

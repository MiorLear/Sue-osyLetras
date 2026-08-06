package com.explorarte.api.media;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

class MediaUrlPolicyTest {

    private final MediaUrlPolicy pinned = new MediaUrlPolicy("https://abc123.supabase.co");
    private final MediaUrlPolicy unconfigured = new MediaUrlPolicy("");

    private static MediaItem attachment(String url) {
        return new MediaItem("id-1", "archivo.pdf", url, "application/pdf", 10);
    }

    @Test
    void acceptsAUrlOnTheConfiguredStorageHost() {
        assertThatCode(() -> pinned.checkAttachments(
                List.of(attachment("https://abc123.supabase.co/storage/v1/object/public/explorarte-media/posts/x.pdf"))))
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
                "http://abc123.supabase.co/x.pdf",
                "blob:https://abc123.supabase.co/uuid")) {
            assertThatThrownBy(() -> unconfigured.checkAttachments(List.of(attachment(url))))
                    .as("url %s", url)
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void rejectsEmbeddedCredentialsAndMissingHosts() {
        assertThatThrownBy(() -> unconfigured.checkStorageUrl("https://user:pass@abc123.supabase.co/x.pdf"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("credentials");
        assertThatThrownBy(() -> unconfigured.checkStorageUrl("https:///x.pdf"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> unconfigured.checkStorageUrl("   "))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> unconfigured.checkStorageUrl("https://exa mple.com/ x"))
                .isInstanceOf(IllegalArgumentException.class);
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
}

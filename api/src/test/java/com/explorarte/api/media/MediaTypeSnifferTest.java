package com.explorarte.api.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class MediaTypeSnifferTest {

    private static byte[] bytes(int... values) {
        byte[] out = new byte[values.length];
        for (int i = 0; i < values.length; i++) out[i] = (byte) values[i];
        return out;
    }

    private static byte[] withPrefix(byte[] prefix, int totalLength) {
        byte[] out = new byte[Math.max(prefix.length, totalLength)];
        System.arraycopy(prefix, 0, out, 0, prefix.length);
        return out;
    }

    @Test
    void detectsCommonImageFormats() {
        assertThat(MediaTypeSniffer.sniff(withPrefix(bytes(0xFF, 0xD8, 0xFF, 0xE0), 16), "a.jpg"))
                .isEqualTo("image/jpeg");
        assertThat(MediaTypeSniffer.sniff(withPrefix(bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A), 16), "a.png"))
                .isEqualTo("image/png");
        assertThat(MediaTypeSniffer.sniff(withPrefix("GIF89a".getBytes(StandardCharsets.US_ASCII), 16), "a.gif"))
                .isEqualTo("image/gif");
    }

    @Test
    void detectsRiffContainersByTheirInnerFormat() {
        byte[] webp = withPrefix("RIFF0000WEBP".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] wav = withPrefix("RIFF0000WAVE".getBytes(StandardCharsets.US_ASCII), 16);
        assertThat(MediaTypeSniffer.sniff(webp, "a.webp")).isEqualTo("image/webp");
        assertThat(MediaTypeSniffer.sniff(wav, "a.wav")).isEqualTo("audio/wav");
        assertThat(MediaTypeSniffer.sniff(withPrefix("RIFF0000AVI ".getBytes(StandardCharsets.US_ASCII), 16), "a.avi"))
                .isNull();
    }

    @Test
    void detectsIsoBaseMediaBrands() {
        assertThat(MediaTypeSniffer.sniff(withPrefix("0000ftypisom".getBytes(StandardCharsets.US_ASCII), 16), "a.mp4"))
                .isEqualTo("video/mp4");
        assertThat(MediaTypeSniffer.sniff(withPrefix("0000ftypqt  ".getBytes(StandardCharsets.US_ASCII), 16), "a.mov"))
                .isEqualTo("video/quicktime");
    }

    @Test
    void detectsPdf() {
        assertThat(MediaTypeSniffer.sniff("%PDF-1.7\n...".getBytes(StandardCharsets.US_ASCII), "a.pdf"))
                .isEqualTo("application/pdf");
    }

    @Test
    void resolvesZipContainersOnlyForTheOoxmlFamily() {
        byte[] zip = withPrefix(bytes(0x50, 0x4B, 0x03, 0x04), 16);
        assertThat(MediaTypeSniffer.sniff(zip, "guia.docx"))
                .isEqualTo("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        assertThat(MediaTypeSniffer.sniff(zip, "payload.zip")).isNull();
        assertThat(MediaTypeSniffer.sniff(zip, "payload.jar")).isNull();
    }

    /** The whole point of SEC-08: browser-executable payloads have no signature
     * we accept, whatever the client claims the Content-Type is. */
    @Test
    void rejectsBrowserExecutableContent() {
        assertThat(MediaTypeSniffer.sniff("<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>"
                .getBytes(StandardCharsets.UTF_8), "logo.svg")).isNull();
        assertThat(MediaTypeSniffer.sniff("<!doctype html><script>alert(1)</script>"
                .getBytes(StandardCharsets.UTF_8), "x.png")).isNull();
        assertThat(MediaTypeSniffer.sniff("alert(document.cookie)".getBytes(StandardCharsets.UTF_8), "x.js")).isNull();
        assertThat(MediaTypeSniffer.sniff(new byte[0], "empty.png")).isNull();
        assertThat(MediaTypeSniffer.sniff(null, "x.png")).isNull();
    }

    @Test
    void noCategoryAcceptsAnExecutableOrUnknownType() {
        for (MediaCategory category : MediaCategory.values()) {
            assertThat(category.allows("text/html")).isFalse();
            assertThat(category.allows("image/svg+xml")).isFalse();
            assertThat(category.allows("application/javascript")).isFalse();
            assertThat(category.allows(null)).isFalse();
            assertThat(category.maxSizeBytes()).isPositive();
            assertThat(category.allowedMimeTypes()).isNotEmpty();
        }
    }

    @Test
    void nonAdminCategoriesAreTheNarrowest() {
        assertThat(MediaCategory.PROFILE.allowedMimeTypes()).containsExactlyInAnyOrder(
                "image/jpeg", "image/png", "image/gif", "image/webp");
        assertThat(MediaCategory.POSTS.allows("application/pdf")).isTrue();
        assertThat(MediaCategory.POSTS.allows("audio/mpeg")).isFalse();
    }
}

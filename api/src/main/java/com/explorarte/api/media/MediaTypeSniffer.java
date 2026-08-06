package com.explorarte.api.media;

import java.util.Locale;
import java.util.Map;

/**
 * Server-side content-type detection from magic bytes.
 *
 * <p>The {@code Content-Type} on a multipart part is attacker-controlled: it is
 * whatever the client typed into the request. Trusting it means an
 * {@code .html} payload can be stored on the Supabase public origin advertised
 * as {@code image/png} — or worse, advertised as {@code text/html} and rendered
 * inline. Every accepted format here is therefore recognised by its own leading
 * bytes, and the value returned is what gets stored and echoed back.
 *
 * <p>Formats with no reliable signature (SVG, HTML, plain text, JS, CSV) return
 * {@code null} and are rejected by the caller. That is deliberate: those are
 * exactly the formats a browser will execute when served from a public bucket.
 */
public final class MediaTypeSniffer {

    /** ZIP containers all share the PK signature, so the OOXML family is
     * disambiguated by extension — and only within this closed set. */
    private static final Map<String, String> OOXML_BY_EXTENSION = Map.of(
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation");

    private MediaTypeSniffer() {
    }

    /**
     * @return the canonical MIME type recognised from {@code bytes}, or
     *         {@code null} when the content is not a format we knowingly host.
     */
    public static String sniff(byte[] bytes, String filename) {
        if (bytes == null || bytes.length < 4) return null;

        if (startsWith(bytes, 0xFF, 0xD8, 0xFF)) return "image/jpeg";
        if (startsWith(bytes, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return "image/png";
        if (matchesAscii(bytes, 0, "GIF87a") || matchesAscii(bytes, 0, "GIF89a")) return "image/gif";
        if (matchesAscii(bytes, 0, "%PDF-")) return "application/pdf";
        if (matchesAscii(bytes, 0, "OggS")) return "audio/ogg";
        if (startsWith(bytes, 0x1A, 0x45, 0xDF, 0xA3)) return "video/webm";

        // RIFF containers: the format lives at offset 8.
        if (matchesAscii(bytes, 0, "RIFF")) {
            if (matchesAscii(bytes, 8, "WEBP")) return "image/webp";
            if (matchesAscii(bytes, 8, "WAVE")) return "audio/wav";
            return null;
        }

        // ISO base media (MP4 / MOV / M4A): "ftyp" box at offset 4, brand at 8.
        if (matchesAscii(bytes, 4, "ftyp")) return isoBaseMediaType(bytes);

        if (matchesAscii(bytes, 0, "ID3") || isMp3FrameSync(bytes)) return "audio/mpeg";

        // ZIP container — accepted only when the extension names an OOXML doc.
        if (startsWith(bytes, 0x50, 0x4B) && (bytes[2] == 0x03 || bytes[2] == 0x05 || bytes[2] == 0x07)) {
            return OOXML_BY_EXTENSION.get(extensionOf(filename));
        }

        return null;
    }

    private static String isoBaseMediaType(byte[] bytes) {
        if (bytes.length < 12) return null;
        String brand = new String(bytes, 8, 4, java.nio.charset.StandardCharsets.US_ASCII);
        if (brand.startsWith("qt")) return "video/quicktime";
        if (brand.startsWith("M4A")) return "audio/mp4";
        return "video/mp4";
    }

    /** MPEG audio frame sync: 11 set bits, with a non-reserved layer/version. */
    private static boolean isMp3FrameSync(byte[] bytes) {
        return (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xE0) == 0xE0 && (bytes[1] & 0x18) != 0x08;
    }

    private static String extensionOf(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean startsWith(byte[] bytes, int... signature) {
        if (bytes.length < signature.length) return false;
        for (int i = 0; i < signature.length; i++) {
            if ((bytes[i] & 0xFF) != signature[i]) return false;
        }
        return true;
    }

    private static boolean matchesAscii(byte[] bytes, int offset, String expected) {
        if (bytes.length < offset + expected.length()) return false;
        for (int i = 0; i < expected.length(); i++) {
            if ((bytes[offset + i] & 0xFF) != expected.charAt(i)) return false;
        }
        return true;
    }
}

package com.explorarte.api.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import com.explorarte.api.common.PayloadTooLargeException;
import com.explorarte.api.common.UnsupportedMediaTypeException;
import com.explorarte.api.security.CurrentUserService;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRole;

/** Hand-rolled stubs rather than Mockito: the toolchain here runs a JDK newer
 * than the Byte Buddy bundled with Spring Boot 3.3, so inline mock creation
 * fails outright. These collaborators are small enough not to need it. */
class MediaUploadControllerTest {

    private static final byte[] PNG = pngBytes();

    private RecordingStorageClient storageClient;
    private MediaUploadController controller;

    private static class RecordingStorageClient extends SupabaseStorageClient {
        String lastPath;
        String lastContentType;
        int uploadCount;

        RecordingStorageClient() {
            super("https://supabase.test", "key");
        }

        @Override
        public String upload(String path, byte[] bytes, String contentType) {
            this.lastPath = path;
            this.lastContentType = contentType;
            this.uploadCount++;
            return "https://supabase.test/storage/v1/object/public/explorarte-media/" + path;
        }
    }

    private static class StubCurrentUserService extends CurrentUserService {
        private final User user;

        StubCurrentUserService(UserRole role) {
            super(null);
            this.user = new User();
            this.user.setId("u-1");
            this.user.setRole(role);
        }

        @Override
        public User currentUser() {
            return user;
        }

        @Override
        public String currentUserId() {
            return user.getId();
        }
    }

    private static byte[] pngBytes() {
        byte[] out = new byte[64];
        byte[] signature = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        System.arraycopy(signature, 0, out, 0, signature.length);
        return out;
    }

    @BeforeEach
    void setUp() {
        storageClient = new RecordingStorageClient();
        controller = new MediaUploadController(storageClient, new StubCurrentUserService(UserRole.TEACHER));
    }

    /** SEC-08: the stored Content-Type comes from the bytes, never from the
     * client-supplied part header. */
    @Test
    void storesTheDetectedTypeNotTheClientClaimedOne() {
        MockMultipartFile file = new MockMultipartFile("file", "foto.png", "text/html", PNG);

        MediaItem item = controller.upload(file, "profile");

        assertThat(storageClient.lastContentType).isEqualTo("image/png");
        assertThat(item.mimeType()).isEqualTo("image/png");
        assertThat(storageClient.lastPath).startsWith("profile/").endsWith("-foto.png");
    }

    @Test
    void rejectsHtmlDisguisedAsAnImage() {
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile("file", "foto.png", "image/png", html);

        assertThatThrownBy(() -> controller.upload(file, "posts"))
                .isInstanceOf(UnsupportedMediaTypeException.class);
        assertThat(storageClient.uploadCount).isZero();
    }

    @Test
    void rejectsSvg() {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile("file", "logo.svg", "image/svg+xml", svg);

        assertThatThrownBy(() -> controller.upload(file, "posts"))
                .isInstanceOf(UnsupportedMediaTypeException.class);
        assertThat(storageClient.uploadCount).isZero();
    }

    @Test
    void rejectsATypeThatIsValidForAnotherCategory() {
        byte[] pdf = "%PDF-1.7 body".getBytes(StandardCharsets.US_ASCII);
        MockMultipartFile file = new MockMultipartFile("file", "cv.pdf", "application/pdf", pdf);

        // A PDF is fine on a post, but a profile photo must be an image.
        assertThatThrownBy(() -> controller.upload(file, "profile"))
                .isInstanceOf(UnsupportedMediaTypeException.class);
        assertThat(controller.upload(file, "posts").mimeType()).isEqualTo("application/pdf");
    }

    @Test
    void rejectsAFileOverTheCategoryCap() {
        byte[] big = new byte[(int) MediaCategory.PROFILE.maxSizeBytes() + 1];
        System.arraycopy(PNG, 0, big, 0, 8);
        MockMultipartFile file = new MockMultipartFile("file", "foto.png", "image/png", big);

        assertThatThrownBy(() -> controller.upload(file, "profile"))
                .isInstanceOf(PayloadTooLargeException.class);
        assertThat(storageClient.uploadCount).isZero();
    }

    @Test
    void rejectsAnEmptyFile() {
        MockMultipartFile file = new MockMultipartFile("file", "foto.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> controller.upload(file, "profile"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void keepsAdminOnlyCategoriesClosedToTeachers() {
        MockMultipartFile file = new MockMultipartFile("file", "foto.png", "image/png", PNG);

        assertThatThrownBy(() -> controller.upload(file, "tools"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    void rejectsAnUnknownCategoryWithoutLeakingTheEnum() {
        assertThatThrownBy(() -> MediaCategory.fromQueryParam("../../etc"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unknown media category");
    }
}

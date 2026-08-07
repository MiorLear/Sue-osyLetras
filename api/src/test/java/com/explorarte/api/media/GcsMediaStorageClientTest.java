package com.explorarte.api.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;

import org.junit.jupiter.api.Test;

import com.explorarte.api.common.StorageUnavailableException;

/**
 * What can be asserted without a Google Cloud project: that an unconfigured
 * bucket degrades to a clean 503 instead of a stack trace or a startup failure.
 * Everything past that point (upload preconditions, v4 signing, the IAM
 * signBlob path) needs a real bucket and is covered by the smoke test in
 * DESPLIEGUE.md, step "Verificar la migración".
 */
class GcsMediaStorageClientTest {

    @Test
    void reportsAnUnconfiguredBucketAsUnavailableRatherThanFailingAtStartup() {
        GcsMediaStorageClient client = new GcsMediaStorageClient("", 900);

        assertThatThrownBy(() -> client.upload("posts/a-b.pdf", new byte[] {1}, "application/pdf"))
                .isInstanceOf(StorageUnavailableException.class)
                .hasMessageContaining("GCS_BUCKET");
        assertThatThrownBy(() -> client.signedReadUrl("posts/a-b.pdf"))
                .isInstanceOf(StorageUnavailableException.class);
    }

    /** Blank-but-present is the same as absent — a Cloud Run env var set to ""
     * must not turn into a bucket named "". */
    @Test
    void treatsAWhitespaceBucketAsUnconfigured() {
        assertThatThrownBy(() -> new GcsMediaStorageClient("   ", 900).signedReadUrl("posts/a-b.pdf"))
                .isInstanceOf(StorageUnavailableException.class);
    }

    @Test
    void exposesTheConfiguredSignatureLifetime() {
        assertThat(new GcsMediaStorageClient("explorarte-media", 900).signedUrlTtl())
                .isEqualTo(Duration.ofMinutes(15));
    }
}

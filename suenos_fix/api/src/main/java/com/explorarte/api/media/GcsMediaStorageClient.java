package com.explorarte.api.media;

import java.net.URI;
import java.net.URL;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.explorarte.api.common.ResourceNotFoundException;
import com.explorarte.api.common.StorageUnavailableException;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageException;
import com.google.cloud.storage.StorageOptions;

/**
 * GCP-04 / SEC-11 — Cloud Storage for Firebase, replacing Supabase Storage.
 *
 * <p>Three things changed with the backend, and each one closes part of SEC-11:
 *
 * <ul>
 *   <li><b>The bucket is private.</b> It has no {@code allUsers} IAM binding, so
 *       {@code https://storage.googleapis.com/<bucket>/<path>} answers 403 to
 *       everyone. The old Supabase bucket was public-read, which made every
 *       upload world-readable forever to anyone who learned the URL.</li>
 *   <li><b>There is no API key in the request path.</b> Supabase needed the
 *       {@code service_role} key — a bearer credential that bypasses RLS and,
 *       being an env var, was as strong as whoever could read the dashboard.
 *       Here the credential is Application Default Credentials: on Cloud Run
 *       that is the service's own service account, granted
 *       {@code roles/storage.objectAdmin} on this one bucket. No key material
 *       exists to leak, and access is revoked by editing an IAM binding.</li>
 *   <li><b>Uploads are create-only.</b> {@code doesNotExist()} sets the
 *       {@code ifGenerationMatch=0} precondition, so an upload to a path that is
 *       already taken fails with 412 instead of silently replacing the bytes
 *       behind a URL that is already cached on teachers' devices — which is what
 *       {@code x-upsert: true} did.</li>
 * </ul>
 *
 * <p><b>Signing on Cloud Run needs one non-obvious IAM grant.</b> Application
 * Default Credentials on Cloud Run have no private key, so {@code signUrl}
 * cannot sign locally: it calls the IAM {@code signBlob} API as itself. That
 * requires the runtime service account to hold
 * {@code roles/iam.serviceAccountTokenCreator} <i>on itself</i>. Without it,
 * uploads succeed and every read fails at signing time — see DESPLIEGUE.md,
 * which sets this up before the first deploy.
 *
 * <p>The {@link Storage} instance is built lazily. Constructing it touches the
 * credential chain (metadata server, {@code GOOGLE_APPLICATION_CREDENTIALS},
 * gcloud config), and doing that eagerly would make the API refuse to start on a
 * laptop with no Google account, which is the normal case for this project.
 */
@Component
public class GcsMediaStorageClient implements MediaStorageClient {

    private final String bucket;
    private final Duration signedUrlTtl;

    private volatile Storage storage;

    public GcsMediaStorageClient(
            @Value("${app.gcs.bucket:}") String bucket,
            @Value("${app.gcs.signed-url-ttl-seconds:900}") long signedUrlTtlSeconds) {
        this.bucket = bucket == null ? "" : bucket.trim();
        this.signedUrlTtl = Duration.ofSeconds(signedUrlTtlSeconds);
    }

    @Override
    public void upload(String objectPath, byte[] bytes, String contentType) {
        BlobInfo blobInfo = BlobInfo.newBuilder(BlobId.of(requireBucket(), objectPath))
                .setContentType(contentType == null || contentType.isBlank()
                        ? "application/octet-stream" : contentType)
                // The path carries a UUID, so the bytes at a given path never
                // change. Marking them immutable lets any cache in front of the
                // bucket keep them without revalidating.
                .setCacheControl("public, max-age=31536000, immutable")
                .build();
        try {
            storage().create(blobInfo, bytes, Storage.BlobTargetOption.doesNotExist());
        } catch (StorageException e) {
            throw new StorageUnavailableException("Could not store the uploaded file", e);
        }
    }

    @Override
    public URI signedReadUrl(String objectPath) {
        BlobId blobId = BlobId.of(requireBucket(), objectPath);
        Blob blob;
        try {
            blob = storage().get(blobId);
        } catch (StorageException e) {
            throw new StorageUnavailableException("Could not reach file storage", e);
        }
        // Signing an absent object would produce a perfectly valid URL that 404s
        // at Cloud Storage. Checking first is what makes "delete the object" an
        // immediate revocation with a 404 the clients already handle.
        if (blob == null) {
            throw new ResourceNotFoundException("File");
        }
        try {
            URL signed = storage().signUrl(
                    BlobInfo.newBuilder(blobId).build(),
                    signedUrlTtl.toSeconds(),
                    TimeUnit.SECONDS,
                    Storage.SignUrlOption.withV4Signature());
            return URI.create(signed.toString());
        } catch (IllegalStateException | StorageException e) {
            // IllegalStateException is what the client throws when the active
            // credentials cannot sign — almost always the missing
            // serviceAccountTokenCreator grant described above.
            throw new StorageUnavailableException("Could not sign a URL for this file", e);
        }
    }

    /** How long a signed URL stays valid. Read by {@link MediaAccessController}
     * so the redirect it caches can never outlive the signature it points at. */
    public Duration signedUrlTtl() {
        return signedUrlTtl;
    }

    private String requireBucket() {
        if (bucket.isEmpty()) {
            throw new StorageUnavailableException("GCS_BUCKET is not configured");
        }
        return bucket;
    }

    private Storage storage() {
        Storage local = storage;
        if (local == null) {
            synchronized (this) {
                local = storage;
                if (local == null) {
                    try {
                        local = StorageOptions.getDefaultInstance().getService();
                    } catch (RuntimeException e) {
                        throw new StorageUnavailableException(
                                "No usable Google Cloud credentials for file storage", e);
                    }
                    storage = local;
                }
            }
        }
        return local;
    }
}

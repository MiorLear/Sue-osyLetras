package com.explorarte.api.media;

import java.net.URI;

/**
 * The object store behind {@code /media/**}. One implementation in production
 * ({@link GcsMediaStorageClient}, Cloud Storage for Firebase); the tests
 * substitute their own.
 *
 * <p>Two operations, and deliberately no "read the bytes" one: the API never
 * proxies file content. It hands out a short-lived signed URL and the client
 * fetches from Cloud Storage directly, so a 40 MB video does not occupy a Cloud
 * Run instance for the length of the download.
 */
public interface MediaStorageClient {

    /**
     * Stores {@code bytes} at {@code objectPath}, which is always
     * {@code <category-prefix>/<uuid>-<sanitised-name>}.
     *
     * <p>Create-only (SEC-11). The Supabase client sent {@code x-upsert: true},
     * so anyone able to guess a path could replace the object behind a URL that
     * was already published and already cached on teachers' phones.
     * Implementations must fail if the path is taken; replacing a file is a
     * delete followed by an upload, which is an explicit act.
     */
    void upload(String objectPath, byte[] bytes, String contentType);

    /**
     * A time-limited, signed URL that reads {@code objectPath} straight from the
     * bucket. Never persisted and never handed to a client as the canonical
     * address of a file — see {@link MediaAccessController} for why that
     * distinction is the whole design.
     *
     * @throws com.explorarte.api.common.ResourceNotFoundException if the object
     *         is not there, so that deleting an object revokes access to it
     *         instead of producing URLs that 404 at Cloud Storage.
     */
    URI signedReadUrl(String objectPath);
}

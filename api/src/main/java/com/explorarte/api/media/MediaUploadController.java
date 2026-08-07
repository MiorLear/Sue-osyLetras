package com.explorarte.api.media;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.explorarte.api.common.PayloadTooLargeException;
import com.explorarte.api.common.UnsupportedMediaTypeException;
import com.explorarte.api.security.CurrentUserService;
import com.explorarte.api.user.UserRole;

/** One generic upload endpoint reused by every screen that needs a real file
 * (tools/resources, emotion stories, learning attachments, screen intro
 * videos, forum attachments, profile photos) instead of a bespoke endpoint
 * per domain. It only uploads bytes and returns a MediaItem — attaching that
 * MediaItem to a domain record happens via the existing PUT/POST endpoints
 * (PUT /tools, PUT /me, POST /posts, ...), which already enforce the right
 * authorization for that write.
 *
 * <p>The content type is never taken from the client: it is detected from the
 * bytes themselves ({@link MediaTypeSniffer}) and checked against the target
 * category's allowlist, together with that category's size cap.
 *
 * <p>GCP-04: the returned {@code url} is the canonical one built by
 * {@link MediaUrlPolicy} — permanent, unsigned, and safe to write to a database
 * row or a phone's cache index. The bucket itself is private; reads go through
 * {@link MediaAccessController}. */
@RestController
public class MediaUploadController {

    private final MediaStorageClient storageClient;
    private final MediaUrlPolicy mediaUrlPolicy;
    private final CurrentUserService currentUserService;

    public MediaUploadController(
            MediaStorageClient storageClient,
            MediaUrlPolicy mediaUrlPolicy,
            CurrentUserService currentUserService) {
        this.storageClient = storageClient;
        this.mediaUrlPolicy = mediaUrlPolicy;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/media/upload")
    @ResponseStatus(HttpStatus.CREATED)
    public MediaItem upload(@RequestParam("file") MultipartFile file, @RequestParam String category) {
        MediaCategory mediaCategory = MediaCategory.fromQueryParam(category);
        if (mediaCategory.isAdminOnly() && currentUserService.currentUser().getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("category '" + category + "' requires an admin account");
        }
        if (file.isEmpty()) {
            throw new IllegalArgumentException("The uploaded file is empty");
        }
        if (file.getSize() > mediaCategory.maxSizeBytes()) {
            throw new PayloadTooLargeException(
                    "File exceeds the " + megabytes(mediaCategory.maxSizeBytes()) + " MB limit for this category");
        }

        String id = UUID.randomUUID().toString();
        String sanitizedFilename = sanitize(file.getOriginalFilename());

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }
        // Re-check after materialising: getSize() is a declared header on some
        // clients, the array length is the truth.
        if (bytes.length > mediaCategory.maxSizeBytes()) {
            throw new PayloadTooLargeException(
                    "File exceeds the " + megabytes(mediaCategory.maxSizeBytes()) + " MB limit for this category");
        }

        String detectedType = MediaTypeSniffer.sniff(bytes, sanitizedFilename);
        if (!mediaCategory.allows(detectedType)) {
            throw new UnsupportedMediaTypeException(
                    "This file type is not accepted for this category. Allowed: " + String.join(", ",
                            new java.util.TreeSet<>(mediaCategory.allowedMimeTypes())));
        }

        String objectPath = mediaCategory.storagePrefix() + "/" + id + "-" + sanitizedFilename;
        storageClient.upload(objectPath, bytes, detectedType);
        return new MediaItem(id, sanitizedFilename, mediaUrlPolicy.canonicalUrl(objectPath),
                detectedType, bytes.length);
    }

    private static long megabytes(long bytes) {
        return bytes / (1024 * 1024);
    }

    private String sanitize(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) return "archivo";
        return originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}

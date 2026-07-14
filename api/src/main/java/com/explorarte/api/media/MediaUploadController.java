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

import com.explorarte.api.security.CurrentUserService;
import com.explorarte.api.user.UserRole;

/** One generic upload endpoint reused by every screen that needs a real file
 * (tools/resources, emotion stories, learning attachments, screen intro
 * videos, forum attachments, profile photos) instead of a bespoke endpoint
 * per domain. It only uploads bytes and returns a MediaItem — attaching that
 * MediaItem to a domain record happens via the existing PUT/POST endpoints
 * (PUT /tools, PUT /me, POST /posts, ...), which already enforce the right
 * authorization for that write. */
@RestController
public class MediaUploadController {

    private final SupabaseStorageClient storageClient;
    private final CurrentUserService currentUserService;

    public MediaUploadController(SupabaseStorageClient storageClient, CurrentUserService currentUserService) {
        this.storageClient = storageClient;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/media/upload")
    @ResponseStatus(HttpStatus.CREATED)
    public MediaItem upload(@RequestParam("file") MultipartFile file, @RequestParam String category) {
        MediaCategory mediaCategory = MediaCategory.fromQueryParam(category);
        if (mediaCategory.isAdminOnly() && currentUserService.currentUser().getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("category '" + category + "' requires an admin account");
        }

        String id = UUID.randomUUID().toString();
        String sanitizedFilename = sanitize(file.getOriginalFilename());
        String path = mediaCategory.storagePrefix() + "/" + id + "-" + sanitizedFilename;

        try {
            String url = storageClient.upload(path, file.getBytes(), file.getContentType());
            return new MediaItem(id, sanitizedFilename, url, file.getContentType(), file.getSize());
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }
    }

    private String sanitize(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) return "archivo";
        return originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}

package com.explorarte.api.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Thin wrapper over Supabase Storage's plain HTTP API (S3-compatible object
 * storage bundled with the same Supabase project used for Postgres). Only
 * this backend ever writes here (clients talk to this API, not Supabase
 * directly). SUPABASE_KEY may be either the service_role key (bypasses RLS —
 * recommended) or the anon key paired with a storage RLS policy that permits
 * uploads. The bucket is public-read, so returned URLs are directly fetchable
 * with no signing. Supabase's API gateway requires both the apikey header and
 * a Bearer token. */
@Component
public class SupabaseStorageClient {

    private static final String BUCKET = "explorarte-media";

    private final RestClient restClient;
    private final String supabaseUrl;

    public SupabaseStorageClient(
            @Value("${app.supabase.url}") String supabaseUrl,
            @Value("${app.supabase.key}") String supabaseKey) {
        this.supabaseUrl = supabaseUrl;
        this.restClient = RestClient.builder()
                .baseUrl(supabaseUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + supabaseKey)
                .defaultHeader("apikey", supabaseKey)
                .build();
    }

    /** Uploads raw bytes under {@code category/path} and returns the public URL. */
    public String upload(String path, byte[] bytes, String contentType) {
        restClient.post()
                .uri("/storage/v1/object/{bucket}/{path}", BUCKET, path)
                .contentType(contentType != null ? MediaType.parseMediaType(contentType) : MediaType.APPLICATION_OCTET_STREAM)
                .header("x-upsert", "true")
                .body(bytes)
                .retrieve()
                .toBodilessEntity();
        return supabaseUrl + "/storage/v1/object/public/" + BUCKET + "/" + path;
    }
}

package com.explorarte.api.auth;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Sends transactional emails via Resend (https://resend.com).
 *
 * <p>Configured with {@code app.resend.api-key} (env {@code RESEND_API_KEY}) and
 * {@code app.resend.from} (env {@code RESEND_FROM}). When the key is absent the
 * service is disabled and simply logs — so local dev works without email.
 *
 * <p>Sends never throw: failures are logged and reported as {@code false}, so the
 * auth endpoints can't leak provider errors to the client (or trigger the
 * error-dispatch that would otherwise surface as a misleading 401).
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_ENDPOINT = "https://api.resend.com/emails";

    private final String apiKey;
    private final String from;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public EmailService(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from:Sueños y Letras <onboarding@resend.dev>}") String from,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.from = from;
        this.objectMapper = objectMapper;
    }

    public boolean isEnabled() {
        return !apiKey.isEmpty();
    }

    /** Emails a password-reset code. Returns false (and logs) if disabled or on any failure. */
    public boolean sendPasswordResetCode(String toEmail, String code) {
        if (!isEnabled()) {
            log.warn("[email] RESEND_API_KEY not set — reset code for {} is {} (NOT sent)", toEmail, code);
            return false;
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("from", from);
            payload.put("to", new String[] { toEmail });
            payload.put("subject", "Tu código para recuperar la contraseña");
            payload.put("html", resetHtml(code));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(RESEND_ENDPOINT))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("[email] reset code sent to {}", toEmail);
                return true;
            }
            log.error("[email] Resend rejected send to {}: HTTP {} {}", toEmail, response.statusCode(), response.body());
            return false;
        } catch (Exception ex) {
            log.error("[email] failed to send reset code to {}: {}", toEmail, ex.toString());
            return false;
        }
    }

    private static String resetHtml(String code) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                  <h2 style="color: #2b2b2b;">Recuperar contraseña</h2>
                  <p>Recibimos una solicitud para restablecer tu contraseña. Tu código de verificación es:</p>
                  <p style="font-size: 30px; font-weight: bold; letter-spacing: 6px; color: #3DBFB8;">%s</p>
                  <p>Vence en 15 minutos. Si no solicitaste esto, puedes ignorar este correo.</p>
                  <p style="color: #888; font-size: 12px; margin-top: 24px;">Sueños y Letras · ExplorArte</p>
                </div>""".formatted(code);
    }
}

package com.explorarte.api.auth;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

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
    private final String passwordResetUrl;
    private final String invitationUrl;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Autowired
    public EmailService(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from:Sueños y Letras <onboarding@resend.dev>}") String from,
            @Value("${app.auth.password-reset-url:https://explorarte.app/forgot-password}") String passwordResetUrl,
            @Value("${app.auth.invitation-url:https://explorarte.app/register}") String invitationUrl,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.from = from;
        this.passwordResetUrl = passwordResetUrl;
        this.invitationUrl = invitationUrl;
        this.objectMapper = objectMapper;
    }

    EmailService(String apiKey, String from, String passwordResetUrl, ObjectMapper objectMapper) {
        this(apiKey, from, passwordResetUrl, "https://explorarte.app/register", objectMapper);
    }

    /**
     * Manda la invitación que emitió una administradora.
     *
     * <p>El token viaja en el enlace y solo aquí: es lo único que el correo
     * lleva que no está también en la base de datos.
     */
    public boolean sendInvitation(String toEmail, String token) {
        return sendHtml(toEmail, "Te invitaron a ExplorArte", invitationHtml(invitationLink(token)));
    }

    String invitationLink(String token) {
        String separator = invitationUrl.contains("?") ? "&" : "?";
        return invitationUrl + separator
                + "invitacion=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
    }

    private boolean sendHtml(String toEmail, String subject, String html) {
        if (!isEnabled()) {
            log.warn("[email] RESEND_API_KEY not set — email to {} was NOT sent", toEmail);
            return false;
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("from", from);
            payload.put("to", new String[] { toEmail });
            payload.put("subject", subject);
            payload.put("html", html);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(RESEND_ENDPOINT))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) return true;
            log.error("[email] Resend rejected send to {}: HTTP {}", toEmail, response.statusCode());
        } catch (Exception ex) {
            log.error("[email] failed to send email to {}: {}", toEmail, ex.getClass().getName());
        }
        return false;
    }

    public boolean isEnabled() {
        return !apiKey.isEmpty();
    }

    /** Emails a one-use password-reset link. Returns false if disabled or on any failure. */
    public boolean sendPasswordResetLink(String toEmail, String identifier, String code) {
        if (!isEnabled()) {
            // SEC-10: never write the code to the log, not even when delivery is disabled.
            log.warn("[email] RESEND_API_KEY not set — reset link for {} was NOT sent", toEmail);
            return false;
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("from", from);
            payload.put("to", new String[] { toEmail });
            payload.put("subject", "Restablece tu contraseña de ExplorArte");
            payload.put("html", resetHtml(HtmlUtils.htmlEscape(resetLink(identifier, code))));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(RESEND_ENDPOINT))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("[email] reset link sent to {}", toEmail);
                return true;
            }
            // Identifier and status only — the provider's body is echoed back from a request
            // that carried the code, so it is not safe to log verbatim (SEC-10).
            log.error("[email] Resend rejected send to {}: HTTP {}", toEmail, response.statusCode());
            return false;
        } catch (Exception ex) {
            log.error("[email] failed to send reset code to {}: {}", toEmail, ex.getClass().getName());
            return false;
        }
    }

    String resetLink(String identifier, String code) {
        String separator = passwordResetUrl.contains("?") ? "&" : "?";
        return passwordResetUrl + separator
                + "email=" + URLEncoder.encode(identifier.trim(), StandardCharsets.UTF_8)
                + "&code=" + URLEncoder.encode(code, StandardCharsets.UTF_8);
    }

    static String resetHtml(String resetLink) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                  <h2 style="color: #2b2b2b;">Recuperar contraseña</h2>
                  <p>Recibimos una solicitud para restablecer tu contraseña.</p>
                  <p style="margin: 28px 0;">
                    <a href="%s" style="display:inline-block;background:#3DBFB8;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px;">Crear nueva contraseña</a>
                  </p>
                  <p>Este enlace vence en 15 minutos y solo puede utilizarse una vez. Si no solicitaste el cambio, puedes ignorar este correo.</p>
                  <p style="color: #888; font-size: 12px; margin-top: 24px;">Sueños y Letras · ExplorArte</p>
                </div>""".formatted(resetLink);
    }

    static String invitationHtml(String invitationLink) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                  <h2 style="color:#2b2b2b;">Te damos la bienvenida a ExplorArte</h2>
                  <p>El equipo de Sueños y Letras te invitó a crear una cuenta en ExplorArte.</p>
                  <p style="margin:28px 0;"><a href="%s" style="display:inline-block;background:#3DBFB8;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px;">Aceptar invitación</a></p>
                  <p>Este enlace vence en 14 días y solo puede utilizarse una vez.</p>
                  <p style="color:#888;font-size:12px;margin-top:24px;">Si no esperabas esta invitación, puedes ignorar este correo.</p>
                </div>""".formatted(HtmlUtils.htmlEscape(invitationLink));
    }
}

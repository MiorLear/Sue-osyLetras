package com.explorarte.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

class EmailServiceTest {

    @Test
    void resetLinkTargetsThePublicPageAndEncodesTheIdentifier() {
        EmailService service = new EmailService(
                "disabled",
                "ExplorArte <no-reply@explorarte.app>",
                "https://explorarte.app/forgot-password",
                new ObjectMapper());

        String link = service.resetLink(" Maestra+Uno@Ejemplo.com ", "123456");

        assertThat(link).isEqualTo(
                "https://explorarte.app/forgot-password?email=Maestra%2BUno%40Ejemplo.com&code=123456");
    }

    @Test
    void invitationLinkCarriesTheTokenOnTheRegistrationPage() {
        EmailService service = new EmailService(
                "disabled",
                "ExplorArte <no-reply@explorarte.app>",
                "https://explorarte.app/forgot-password",
                new ObjectMapper());

        // El token sale de Base64 URL-safe, que trae '-' y '_'; lo que no puede
        // es romper el enlace, asi que va codificado igual.
        String link = service.invitationLink("abc-123_XYZ");

        assertThat(link).isEqualTo("https://explorarte.app/register?invitacion=abc-123_XYZ");
    }

    @Test
    void invitationEmailContainsTheButtonTheLinkAndTheExpiry() {
        String html = EmailService.invitationHtml("https://explorarte.app/register?invitacion=t0ken");

        assertThat(html)
                .contains("Aceptar invitación")
                .contains("vence en 14 días")
                .contains("https://explorarte.app/register?invitacion=t0ken");
    }

    @Test
    void resetEmailContainsAButtonAndTheExpiryNotice() {
        String html = EmailService.resetHtml(
                "https://explorarte.app/forgot-password?email=a%40b.com&amp;code=123456");

        assertThat(html)
                .contains("Crear nueva contraseña")
                .contains("vence en 15 minutos")
                .contains("https://explorarte.app/forgot-password");
    }
}

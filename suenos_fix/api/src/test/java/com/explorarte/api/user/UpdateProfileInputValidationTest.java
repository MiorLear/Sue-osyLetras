package com.explorarte.api.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

class UpdateProfileInputValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void openValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        factory.close();
    }

    private static Set<String> invalidPathsOf(Object input) {
        return validator.validate(input).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(String::valueOf)
                .collect(Collectors.toSet());
    }

    private static UpdateProfileInput of(String email, String phone) {
        return new UpdateProfileInput("Ana", "Pérez", email, phone, "Escuela 1", "San José", null);
    }

    @Test
    void acceptsATypicalProfileSave() {
        assertThat(invalidPathsOf(of("ana@escuela.cr", "8888-8888"))).isEmpty();
        assertThat(invalidPathsOf(of("ana@escuela.cr", ""))).isEmpty();
        assertThat(invalidPathsOf(new UpdateProfileInput(null, null, null, null, null, null, null))).isEmpty();
    }

    /** BUG-13: the email column is the login identity, so a malformed or blank
     * value must not reach it. */
    @Test
    void rejectsAMalformedOrBlankEmail() {
        assertThat(invalidPathsOf(of("no-es-un-email", null))).contains("email");
        assertThat(invalidPathsOf(of("a@", null))).contains("email");
        assertThat(invalidPathsOf(of("  ", null))).contains("emailPresentAndUsable");
        assertThat(invalidPathsOf(of("a".repeat(160) + "@x.com", null))).contains("email");
    }

    @Test
    void rejectsAMalformedPhone() {
        assertThat(invalidPathsOf(of("ana@escuela.cr", "no-es-un-telefono"))).contains("phone");
        assertThat(invalidPathsOf(of("ana@escuela.cr", "12345"))).contains("phone");
    }

    @Test
    void rejectsBlankNamesThatWouldWipeNotNullColumns() {
        assertThat(invalidPathsOf(new UpdateProfileInput("  ", null, null, null, null, null, null)))
                .contains("namePresentAndUsable");
        assertThat(invalidPathsOf(new UpdateProfileInput(null, "  ", null, null, null, null, null)))
                .contains("lastnamePresentAndUsable");
    }

    @Test
    void capsEveryFieldToItsColumnWidth() {
        assertThat(invalidPathsOf(new UpdateProfileInput("n".repeat(121), null, null, null, null, null, null)))
                .contains("name");
        assertThat(invalidPathsOf(new UpdateProfileInput(null, "l".repeat(121), null, null, null, null, null)))
                .contains("lastname");
        assertThat(invalidPathsOf(new UpdateProfileInput(null, null, null, null, "i".repeat(161), null, null)))
                .contains("institucion");
        assertThat(invalidPathsOf(new UpdateProfileInput(null, null, null, null, null, "u".repeat(161), null)))
                .contains("ubicacion");
    }
}

package com.explorarte.api.community;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import com.explorarte.api.media.MediaItem;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

class CommunityInputValidationTest {

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

    private static MediaItem attachment() {
        return new MediaItem("id-1", "x.pdf", "https://storage.test/x.pdf", "application/pdf", 1);
    }

    @Test
    void acceptsAWellFormedPost() {
        assertThat(invalidPathsOf(new CreatePostInput("Hola", "alegria", List.of(attachment())))).isEmpty();
        assertThat(invalidPathsOf(new CreatePostInput("Hola", null, null))).isEmpty();
    }

    @Test
    void requiresPostText() {
        assertThat(invalidPathsOf(new CreatePostInput(null, null, null))).contains("text");
        assertThat(invalidPathsOf(new CreatePostInput("   ", null, null))).contains("text");
    }

    @Test
    void capsPostTextAndModuleToWhatTheColumnsHold() {
        assertThat(invalidPathsOf(new CreatePostInput("x".repeat(5001), null, null))).contains("text");
        assertThat(invalidPathsOf(new CreatePostInput("ok", "m".repeat(65), null))).contains("module");
    }

    @Test
    void capsTheAttachmentCountAndValidatesEachEntry() {
        assertThat(invalidPathsOf(new CreatePostInput("ok", null, Collections.nCopies(11, attachment()))))
                .contains("attachments");

        MediaItem broken = new MediaItem("", "x", "", "application/pdf", -1);
        assertThat(invalidPathsOf(new CreatePostInput("ok", null, List.of(broken))))
                .contains("attachments[0].id", "attachments[0].url", "attachments[0].sizeBytes");
    }

    @Test
    void requiresCommentText() {
        assertThat(invalidPathsOf(new CreateCommentInput(null))).contains("text");
        assertThat(invalidPathsOf(new CreateCommentInput(" "))).contains("text");
        assertThat(invalidPathsOf(new CreateCommentInput("x".repeat(2001)))).contains("text");
        assertThat(invalidPathsOf(new CreateCommentInput("Buen aporte"))).isEmpty();
    }
}

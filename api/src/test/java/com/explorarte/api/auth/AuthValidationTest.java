package com.explorarte.api.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import com.explorarte.api.security.AuthenticatedUserCache;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

/**
 * SEC-07 and SEC-13 on the auth endpoints: request bodies are validated, and there is a real
 * password policy.
 *
 * <p>{@code @Valid}, {@code @NotBlank}, {@code @Size}, {@code @Email} and {@code @Pattern}
 * appeared zero times in the repository despite spring-boot-starter-validation being a
 * declared dependency, so nothing checked required fields, lengths or formats — oversize
 * strings reached the database and came back as 500s. A one-character password was accepted,
 * and a blank one silently became a random UUID, leaving an account nobody could sign into.
 */
class AuthValidationTest {

    private UserRepository userRepository;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthController controller = new AuthController(
                userRepository,
                new BCryptPasswordEncoder(),
                AuthTestFixture.jwtService(),
                AuthTestFixture.codeService(new InMemoryCodeStore().asRepository()),
                AuthTestFixture.disabledEmailService(),
                AuthTestFixture.schoolService(),
                AuthTestFixture.noRateLimit(),
                new AuthenticatedUserCache(userRepository, 0, 1000));

        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new AuthExceptionHandler())
                .setValidator(new LocalValidatorFactoryBean())
                .build();
    }

    private org.springframework.test.web.servlet.ResultActions postJson(String path, String body)
            throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    // --- SEC-07: field-level 400s ------------------------------------------

    @Test
    void loginWithoutAnEmailIs400WithAFieldLevelError() throws Exception {
        postJson("/auth/login", """
                {"email":"","password":"una-contrasena"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").exists());
    }

    @Test
    void loginWithAMalformedEmailIs400() throws Exception {
        postJson("/auth/login", """
                {"email":"no-es-un-correo","password":"una-contrasena"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").exists());
    }

    @Test
    void anOversizeFieldIs400NotA500FromTheDatabase() throws Exception {
        String longName = "a".repeat(200); // users.name is VARCHAR(120)

        postJson("/auth/register", """
                {"name":"%s","lastname":"García","email":"nueva@ejemplo.com",
                 "password":"una-contrasena","phone":"+503 7000 0000",
                 "institucion":"Escuela","ubicacion":"San Salvador"}"""
                .formatted(longName))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.name").exists());

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void anOtpCodeThatIsNotSixDigitsIs400AndNeverSpendsAnAttempt() throws Exception {
        postJson("/auth/otp/verify", """
                {"phone":"+503 7000 0000","code":"12"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.code").exists());
    }

    // --- SEC-13: password policy -------------------------------------------

    @Test
    void aOneCharacterPasswordIsRefusedAtRegistration() throws Exception {
        postJson("/auth/register", """
                {"name":"Ana","lastname":"Pérez","email":"ana@ejemplo.com","password":"x",
                 "institucion":"Escuela","ubicacion":"San Salvador","phone":""}""")
                .andExpect(status().isBadRequest());

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void anEmailSignupWithoutAPasswordIsRefusedInsteadOfCreatingAnUnusableAccount()
            throws Exception {
        postJson("/auth/register", """
                {"name":"Ana","lastname":"Pérez","email":"ana@ejemplo.com","password":"",
                 "institucion":"Escuela","ubicacion":"San Salvador","phone":""}""")
                .andExpect(status().isBadRequest());

        verify(userRepository, never()).save(any(User.class));
    }

    /** The clients post an empty password on the phone-only path; that must keep working. */
    @Test
    void aPhoneOnlySignupWithoutAPasswordStillWorks() throws Exception {
        postJson("/auth/register", """
                {"name":"Ana","lastname":"Pérez","email":"","password":"","phone":"+503 7000 0000",
                 "institucion":"Escuela","ubicacion":"San Salvador"}""")
                .andExpect(status().isCreated());

        verify(userRepository).save(any(User.class));
    }

    @Test
    void aValidEmailSignupIsAccepted() throws Exception {
        postJson("/auth/register", """
                {"name":"Ana","lastname":"Pérez","email":"ana@ejemplo.com","password":"una-contrasena",
                 "institucion":"Escuela","ubicacion":"San Salvador","phone":""}""")
                .andExpect(status().isCreated());

        verify(userRepository).save(any(User.class));
    }

    @Test
    void aDuplicateEmailIs409NotABare500() throws Exception {
        User existing = new User();
        existing.setId("u-existing");
        existing.setEmail("ana@ejemplo.com");
        existing.setRole(UserRole.TEACHER);
        existing.setStatus(UserStatus.APPROVED);
        when(userRepository.findByEmailIgnoreCase("ana@ejemplo.com")).thenReturn(Optional.of(existing));

        postJson("/auth/register", """
                {"name":"Ana","lastname":"Pérez","email":"ana@ejemplo.com","password":"una-contrasena",
                 "institucion":"Escuela","ubicacion":"San Salvador","phone":""}""")
                .andExpect(status().isConflict());

        verify(userRepository, never()).save(any(User.class));
    }

    // --- SEC-16 / CVE-2025-22228 -------------------------------------------

    @Test
    void aPasswordLongerThanBcryptComparesIsRefused() throws Exception {
        String tooLong = "a".repeat(PasswordPolicy.MAX_BYTES + 1);

        postJson("/auth/register", """
                {"name":"Ana","lastname":"Pérez","email":"ana@ejemplo.com","password":"%s",
                 "institucion":"Escuela","ubicacion":"San Salvador","phone":""}"""
                .formatted(tooLong))
                .andExpect(status().isBadRequest());

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void theMaximumIsMeasuredInBytesNotCharacters() {
        // 40 accented characters are 80 UTF-8 bytes: under the character count, over the cap
        // BCrypt actually truncates on.
        String accented = "á".repeat(40);

        org.assertj.core.api.Assertions.assertThat(accented.length())
                .isLessThan(PasswordPolicy.MAX_BYTES);
        org.assertj.core.api.Assertions.assertThat(PasswordPolicy.exceedsMaximum(accented)).isTrue();
        org.assertj.core.api.Assertions.assertThat(PasswordPolicy.isAcceptable(accented)).isFalse();
    }

    @Test
    void anOverlongLoginPasswordIs401AndNeverReachesBcrypt() throws Exception {
        User user = new User();
        user.setId("u-test");
        user.setEmail("ana@ejemplo.com");
        user.setPasswordHash(new BCryptPasswordEncoder().encode("una-contrasena"));
        user.setRole(UserRole.TEACHER);
        user.setStatus(UserStatus.APPROVED);
        when(userRepository.findByEmailIgnoreCase("ana@ejemplo.com")).thenReturn(Optional.of(user));

        postJson("/auth/login", """
                {"email":"ana@ejemplo.com","password":"%s"}"""
                .formatted("una-contrasena" + "x".repeat(PasswordPolicy.MAX_BYTES)))
                .andExpect(status().isUnauthorized());
    }
}

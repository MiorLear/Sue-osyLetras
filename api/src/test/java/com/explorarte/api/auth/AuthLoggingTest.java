package com.explorarte.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.explorarte.api.security.AuthenticatedUserCache;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

/**
 * SEC-10 — no verification code may reach the logs at any level. On Render these logs are
 * retained and readable from the dashboard, so a logged OTP is a credential handed out.
 *
 * <p>The code service and the email service are the real ones, so this exercises the actual
 * log statements rather than a stub of them. Email delivery is disabled (no Resend key),
 * which is precisely the branch that used to print the reset code.
 */
class AuthLoggingTest {

    private static final String PHONE = "+503 7000 0000";

    private ListAppender<ILoggingEvent> appender;
    private Logger rootLogger;
    private Level previousLevel;
    private InMemoryCodeStore codeStore;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        codeStore = new InMemoryCodeStore();
        UserRepository userRepository = mock(UserRepository.class);

        User user = new User();
        user.setId("u-test");
        user.setEmail("maria@ejemplo.com");
        user.setRole(UserRole.TEACHER);
        user.setStatus(UserStatus.APPROVED);
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.of(user));

        AuthController controller = new AuthController(
                userRepository,
                new BCryptPasswordEncoder(),
                AuthTestFixture.jwtService(),
                AuthTestFixture.codeService(codeStore.asRepository()),
                AuthTestFixture.disabledEmailService(),
                AuthTestFixture.schoolService(),
                AuthTestFixture.noRateLimit(),
                new AuthenticatedUserCache(userRepository, 0, 1000));
        mvc = MockMvcBuilders.standaloneSetup(controller).build();

        rootLogger = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        previousLevel = rootLogger.getLevel();
        rootLogger.setLevel(Level.TRACE);
        appender = new ListAppender<>();
        appender.start();
        rootLogger.addAppender(appender);
    }

    @AfterEach
    void tearDown() {
        rootLogger.detachAppender(appender);
        rootLogger.setLevel(previousLevel);
    }

    private List<String> loggedMessages() {
        return appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    }

    private String storedCodeFor(String identifier) {
        return codeStore.find(VerificationCodeService.normalize(identifier)).orElseThrow().getCode();
    }

    @Test
    void requestingAnOtpLogsNoCode() throws Exception {
        mvc.perform(post("/auth/otp/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"%s"}""".formatted(PHONE)))
                .andExpect(status().isOk());

        String code = storedCodeFor(PHONE);
        assertThat(loggedMessages()).noneMatch(message -> message.contains(code));
    }

    @Test
    void aFailedResetEmailLogsTheAddressButNotTheCode() throws Exception {
        mvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"emailOrPhone":"maria@ejemplo.com"}"""))
                .andExpect(status().isOk());

        String code = storedCodeFor("maria@ejemplo.com");
        assertThat(loggedMessages())
                .as("the failure must still be diagnosable")
                .anyMatch(message -> message.contains("maria@ejemplo.com"));
        assertThat(loggedMessages())
                .as("neither AuthController nor EmailService may print the code")
                .noneMatch(message -> message.contains(code));
    }
}

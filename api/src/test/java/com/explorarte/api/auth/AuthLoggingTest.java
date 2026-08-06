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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.explorarte.api.misc.SchoolService;
import com.explorarte.api.security.AuthRateLimiter;
import com.explorarte.api.security.AuthenticatedUserCache;
import com.explorarte.api.security.JwtService;
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
 */
class AuthLoggingTest {

    private static final String SECRET_CODE = "424242";

    private ListAppender<ILoggingEvent> appender;
    private Logger rootLogger;
    private MockMvc mvc;
    private EmailService emailService;

    @BeforeEach
    void setUp() {
        VerificationCodeService codes = mock(VerificationCodeService.class);
        when(codes.issue(anyString())).thenReturn(SECRET_CODE);

        UserRepository userRepository = mock(UserRepository.class);
        User user = new User();
        user.setId("u-test");
        user.setEmail("maria@ejemplo.com");
        user.setRole(UserRole.TEACHER);
        user.setStatus(UserStatus.APPROVED);
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.of(user));

        emailService = mock(EmailService.class);
        // Force the failure path: this is exactly where the code used to be logged.
        when(emailService.sendPasswordResetCode(anyString(), anyString())).thenReturn(false);

        AuthController controller = new AuthController(
                userRepository,
                mock(PasswordEncoder.class),
                mock(JwtService.class),
                codes,
                emailService,
                mock(SchoolService.class),
                new AuthRateLimiter(false, 1, 1, 1, 1, 1000),
                mock(AuthenticatedUserCache.class));
        mvc = MockMvcBuilders.standaloneSetup(controller).build();

        rootLogger = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        rootLogger.setLevel(Level.TRACE);
        appender = new ListAppender<>();
        appender.start();
        rootLogger.addAppender(appender);
    }

    @AfterEach
    void tearDown() {
        rootLogger.detachAppender(appender);
    }

    private List<String> loggedMessages() {
        return appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    }

    @Test
    void requestingAnOtpLogsNoCode() throws Exception {
        mvc.perform(post("/auth/otp/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"+503 7000 0000"}"""))
                .andExpect(status().isOk());

        assertThat(loggedMessages()).noneMatch(message -> message.contains(SECRET_CODE));
    }

    @Test
    void aFailedResetEmailLogsTheAddressButNotTheCode() throws Exception {
        mvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"emailOrPhone":"maria@ejemplo.com"}"""))
                .andExpect(status().isOk());

        assertThat(loggedMessages())
                .as("the failure must still be diagnosable")
                .anyMatch(message -> message.contains("maria@ejemplo.com"));
        assertThat(loggedMessages()).noneMatch(message -> message.contains(SECRET_CODE));
    }
}

package com.explorarte.api.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.explorarte.api.calendar.CalendarEventRepository;
import com.explorarte.api.community.CommentRepository;
import com.explorarte.api.community.PostRepository;
import com.explorarte.api.emotions.EmotionContentRepository;
import com.explorarte.api.emotions.EmotionRepository;
import com.explorarte.api.learning.TopicRepository;
import com.explorarte.api.misc.SchoolRepository;
import com.explorarte.api.tools.ToolsContentRepository;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;

/**
 * SEC-02 — the demo accounts only exist when a password is injected at runtime. render.yaml
 * used to commit a working one for {@code admin@explorarte.org} with ADMIN in a public repo.
 */
class DataSeederGateTest {

    private UserRepository userRepository;

    private DataSeeder seederWith(String seedPassword) {
        userRepository = mock(UserRepository.class);
        when(userRepository.count()).thenReturn(0L);

        // Every other repository reports "already seeded" so this test only exercises users.
        EmotionRepository emotions = mock(EmotionRepository.class);
        when(emotions.count()).thenReturn(1L);
        PostRepository posts = mock(PostRepository.class);
        when(posts.count()).thenReturn(1L);
        CalendarEventRepository events = mock(CalendarEventRepository.class);
        when(events.count()).thenReturn(1L);
        TopicRepository topics = mock(TopicRepository.class);
        when(topics.count()).thenReturn(1L);
        ToolsContentRepository tools = mock(ToolsContentRepository.class);
        when(tools.count()).thenReturn(1L);
        SchoolRepository schools = mock(SchoolRepository.class);
        when(schools.count()).thenReturn(1L);

        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.encode(org.mockito.ArgumentMatchers.anyString())).thenReturn("$2a$10$hash");

        return new DataSeeder(
                userRepository, emotions, mock(EmotionContentRepository.class), posts,
                mock(CommentRepository.class), events, topics, tools, schools, encoder, seedPassword);
    }

    @Test
    void withoutAnInjectedPasswordNoUserIsCreated() {
        DataSeeder seeder = seederWith("");

        seeder.run(new DefaultApplicationArguments());

        assertThat(seeder.seedUsersAllowed()).isFalse();
        verify(userRepository, never()).saveAll(org.mockito.ArgumentMatchers.anyList());
    }

    @Test
    void aNullOrTrivialPasswordIsAlsoRefused() {
        assertThat(seederWith(null).seedUsersAllowed()).isFalse();
        assertThat(seederWith("   ").seedUsersAllowed()).isFalse();
        assertThat(seederWith("short").seedUsersAllowed()).isFalse();
    }

    @Test
    @SuppressWarnings("unchecked")
    void withAnInjectedPasswordTheDemoAccountsAreCreated() {
        DataSeeder seeder = seederWith("una-contrasena-inyectada");

        seeder.run(new DefaultApplicationArguments());

        assertThat(seeder.seedUsersAllowed()).isTrue();
        var saved = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(userRepository).saveAll(saved.capture());
        assertThat((List<User>) saved.getValue()).isNotEmpty();
    }
}

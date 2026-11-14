package com.explorarte.api.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.explorarte.api.common.ApiExceptionHandler;
import com.explorarte.api.security.AuthenticatedUserCache;

/**
 * POST /admin/users/{id}/promote con MockMvc standalone. La cache de usuarios
 * autenticados es la real (con un TTL largo) para poder afirmar que la
 * promocion se ve en la siguiente peticion y no al vencer la cache.
 */
class AdminUserControllerPromoteTest {

    private Map<String, User> rows;
    private UserRepository userRepository;
    private AuthenticatedUserCache userCache;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        rows = new HashMap<>();
        userRepository = mock(UserRepository.class);
        when(userRepository.findById(anyString()))
                .thenAnswer(call -> Optional.ofNullable(rows.get(call.<String>getArgument(0))));
        when(userRepository.save(any(User.class))).thenAnswer(call -> {
            User user = call.getArgument(0);
            rows.put(user.getId(), user);
            return user;
        });

        userCache = new AuthenticatedUserCache(userRepository, 3600, 100);
        AdminUserController controller = new AdminUserController(userRepository, null, userCache);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    private User user(String id, UserRole role, UserStatus status) {
        User user = new User();
        user.setId(id);
        user.setName("Ana");
        user.setLastname("Perez");
        user.setEmail(id + "@ejemplo.com");
        user.setRole(role);
        user.setStatus(status);
        rows.put(id, user);
        return user;
    }

    @Test
    void promueveADocenteConAccesoYLaCacheLoVeEnSeguida() throws Exception {
        user("u-1", UserRole.TEACHER, UserStatus.APPROVED);
        assertThat(userCache.find("u-1")).get().extracting(AuthenticatedUserCache.Snapshot::role)
                .isEqualTo(UserRole.TEACHER);

        mvc.perform(post("/admin/users/u-1/promote"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("admin"))
                .andExpect(jsonPath("$.status").value("approved"));

        assertThat(rows.get("u-1").getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(userCache.find("u-1")).get().extracting(AuthenticatedUserCache.Snapshot::role)
                .isEqualTo(UserRole.ADMIN);
    }

    @Test
    void unaCuentaPendienteQuedaAprobadaAlPromoverla() throws Exception {
        user("u-2", UserRole.TEACHER, UserStatus.PENDING);

        mvc.perform(post("/admin/users/u-2/promote"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("approved"));
    }

    @Test
    void unaCuentaSinAccesoSeRechazaConConflicto() throws Exception {
        user("u-3", UserRole.TEACHER, UserStatus.REJECTED);

        mvc.perform(post("/admin/users/u-3/promote"))
                .andExpect(status().isConflict());

        assertThat(rows.get("u-3").getRole()).isEqualTo(UserRole.TEACHER);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void promoverAUnaAdminNoCambiaNada() throws Exception {
        user("u-4", UserRole.ADMIN, UserStatus.APPROVED);

        mvc.perform(post("/admin/users/u-4/promote"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("admin"));

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void usuarioInexistenteDa404() throws Exception {
        mvc.perform(post("/admin/users/nadie/promote"))
                .andExpect(status().isNotFound());
    }
}

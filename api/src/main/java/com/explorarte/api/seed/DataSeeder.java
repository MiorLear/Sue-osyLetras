package com.explorarte.api.seed;

import java.time.LocalDate;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.explorarte.api.calendar.CalendarEvent;
import com.explorarte.api.calendar.CalendarEventRepository;
import com.explorarte.api.calendar.EventType;
import com.explorarte.api.community.Comment;
import com.explorarte.api.community.CommentRepository;
import com.explorarte.api.community.Post;
import com.explorarte.api.community.PostRepository;
import com.explorarte.api.emotions.Emotion;
import com.explorarte.api.emotions.EmotionActivity;
import com.explorarte.api.emotions.EmotionContent;
import com.explorarte.api.emotions.EmotionContentRepository;
import com.explorarte.api.emotions.EmotionRepository;
import com.explorarte.api.misc.School;
import com.explorarte.api.misc.SchoolRepository;
import com.explorarte.api.tools.ToolsContentEntity;
import com.explorarte.api.tools.ToolsContentRepository;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;

/**
 * Seeds the database with the same content as shared/src/api/mock/seed.ts, so
 * the real API behaves identically to the mock the frontend already works
 * against. Guarded per-table so it's safe to run on every boot.
 */
@Component
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepository;
    private final EmotionRepository emotionRepository;
    private final EmotionContentRepository emotionContentRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final CalendarEventRepository calendarEventRepository;
    private final ToolsContentRepository toolsContentRepository;
    private final SchoolRepository schoolRepository;
    private final PasswordEncoder passwordEncoder;
    private final String defaultPassword;

    public DataSeeder(
            UserRepository userRepository,
            EmotionRepository emotionRepository,
            EmotionContentRepository emotionContentRepository,
            PostRepository postRepository,
            CommentRepository commentRepository,
            CalendarEventRepository calendarEventRepository,
            ToolsContentRepository toolsContentRepository,
            SchoolRepository schoolRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.seed.default-password:}") String defaultPassword) {
        this.userRepository = userRepository;
        this.emotionRepository = emotionRepository;
        this.emotionContentRepository = emotionContentRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.calendarEventRepository = calendarEventRepository;
        this.toolsContentRepository = toolsContentRepository;
        this.schoolRepository = schoolRepository;
        this.passwordEncoder = passwordEncoder;
        this.defaultPassword = defaultPassword == null ? "" : defaultPassword.trim();
    }

    /** Shortest seed password worth accepting; anything less is a typo, not a decision. */
    static final int MIN_SEED_PASSWORD_LENGTH = 8;

    /**
     * SEC-02: the demo accounts are only created when a password is injected at runtime, and
     * nothing in version control injects one. render.yaml used to commit a working literal
     * for {@code admin@explorarte.org} — with {@code UserRole.ADMIN} — in a public repository.
     */
    boolean seedUsersAllowed() {
        return defaultPassword.length() >= MIN_SEED_PASSWORD_LENGTH;
    }

    /**
     * Cada paso corre aislado: en su propia transaccion y con su propio catch.
     *
     * Antes el metodo entero era {@code @Transactional}, y eso tenia dos
     * consecuencias que juntas tumbaron la API el 21-sep-2026. La primera es
     * que el insert de {@link #seedEvents()} no fallaba dentro del metodo sino
     * al hacer commit al salir de aqui, fuera del alcance de cualquier catch
     * que se pusiera dentro. La segunda es que, al ser esto un
     * {@link ApplicationRunner}, la excepcion subia hasta Spring y mataba el
     * contexto cuando Tomcat ya aceptaba peticiones: el contenedor arrancaba,
     * atendia durante un segundo y se caia con exit(1). Cloud Run levantaba
     * otro, y asi en bucle, de modo que casi cada peticion pagaba un arranque
     * en frio de 13 s.
     *
     * Sembrar datos de ejemplo no puede impedir que la API arranque. Sin la
     * anotacion envolvente cada {@code saveAll} de Spring Data abre y cierra su
     * propia transaccion, asi que un fallo se lanza donde se puede atrapar y no
     * arrastra a los demas pasos.
     */
    @Override
    public void run(ApplicationArguments args) {
        seed("users", this::seedUsers);
        seed("schools", this::seedSchools);
        seed("emotions", this::seedEmotions);
        seed("tools", this::seedTools);
        seed("posts", this::seedPosts);
        seed("events", this::seedEvents);
    }

    private void seed(String step, Runnable action) {
        try {
            action.run();
        } catch (RuntimeException e) {
            log.error("Fallo el sembrado de '{}'. La API sigue arrancando sin esos datos.", step, e);
        }
    }

    /**
     * GCP-07 bis: las filas de ejemplo apuntan por clave foranea a las cuentas
     * de ejemplo, y {@link #seedUsers()} solo las crea cuando se inyecta
     * SEED_USER_PASSWORD (SEC-02). Preguntar "hay usuarios?" no es la misma
     * pregunta: en produccion hay docentes reales y ninguna cuenta de ejemplo,
     * y esa es justo la combinacion que reventaba la FK.
     */
    private boolean demoUsersMissing(String... ids) {
        for (String id : ids) {
            if (!userRepository.existsById(id)) {
                log.info("Omitiendo datos de ejemplo: la cuenta {} no existe.", id);
                return true;
            }
        }
        return false;
    }

    private void seedUsers() {
        if (userRepository.count() > 0) return;
        if (!seedUsersAllowed()) {
            log.warn("Skipping demo user seeding: SEED_USER_PASSWORD is unset or shorter than {} "
                    + "characters. This is the safe default — set it only where a known-password "
                    + "account is acceptable.", MIN_SEED_PASSWORD_LENGTH);
            return;
        }
        // SEC-10: the seed password used to be written here verbatim on every cold boot,
        // and Render keeps those logs readable from the dashboard.
        log.info("Seeding demo users with the injected SEED_USER_PASSWORD");
        String hash = passwordEncoder.encode(defaultPassword);
        userRepository.saveAll(List.of(
                user("u-admin", "Carlos", "Méndez", "admin@explorarte.org", "+503 7000 0000",
                        "Sueños y Letras", "San Salvador", UserRole.ADMIN, hash),
                user("u-maria", "María Reneé", "García López", "maria@ejemplo.com", "+503 7000 1234",
                        "Colegio Americano", "San Salvador", UserRole.TEACHER, hash),
                user("u-ana", "Ana", "Pérez", "ana@ejemplo.com", "+503 7222 1111",
                        "Escuela Nacional Primaria", "Santa Tecla, La Libertad", UserRole.TEACHER, hash),
                user("u-lucia", "Lucía", "Ramírez", "lucia@ejemplo.com", "+503 7333 2222",
                        "Colegio La Salle", "Soyapango, San Salvador", UserRole.TEACHER, hash),
                user("u-sofia", "Sofía", "Hernández", "sofia@ejemplo.com", "+503 7444 3333",
                        "Instituto Bilingüe", "Antiguo Cuscatlán, La Libertad", UserRole.TEACHER, hash)));
    }

    private User user(String id, String name, String lastname, String email, String phone,
                       String institucion, String ubicacion, UserRole role, String passwordHash) {
        User u = new User();
        u.setId(id);
        u.setName(name);
        u.setLastname(lastname);
        u.setEmail(email);
        u.setPhone(phone);
        u.setInstitucion(institucion);
        u.setUbicacion(ubicacion);
        u.setRole(role);
        u.setStatus(UserStatus.APPROVED);
        u.setPasswordHash(passwordHash);
        return u;
    }

    private void seedSchools() {
        if (schoolRepository.count() > 0) return;
        List.of("Colegio Americano", "Escuela Nacional Primaria", "Colegio La Salle",
                "Instituto Bilingüe", "Escuela Pública Central", "Colegio San Francisco")
                .forEach(name -> {
                    School s = new School();
                    s.setName(name);
                    schoolRepository.save(s);
                });
    }

    private void seedEmotions() {
        if (emotionRepository.count() > 0) return;
        record E(String id, String name, String emoji, String color, String bg,
                 String description, String classroom, List<String> questions,
                 List<String> activities, List<String> stories) {}

        List<E> emotions = List.of(
                new E("alegria", "Alegría", "😊", "#F0B429", "#FFFBEB",
                        "La alegría es una emoción positiva que surge cuando algo bueno nos sucede o anticipamos algo agradable.",
                        "Puede verse en risas, energía elevada, deseos de compartir con otros.",
                        List.of("¿Qué cosas te hacen sentir alegría?", "¿Cómo compartes tu alegría con los demás?", "¿Puedes recordar un momento muy feliz?"),
                        List.of("Dibuja un momento feliz", "Crea un mural de cosas que te alegran", "Comparte una buena noticia con el grupo"),
                        List.of("El Principito — Antoine de Saint-Exupéry", "Pollyanna — Eleanor H. Porter")),
                new E("tristeza", "Tristeza", "😢", "#4299E1", "#EBF8FF",
                        "La tristeza aparece ante una pérdida, decepción o cuando algo importante no sale como esperábamos.",
                        "Puede verse en quietud, llanto, aislamiento o falta de energía.",
                        List.of("¿Qué haces cuando te sientes triste?", "¿A quién buscas cuando estás triste?", "¿Qué te ayuda a sentirte mejor?"),
                        List.of("Carta a un amigo que está triste", "Rincón de la calma", "Dibuja lo que sientes hoy"),
                        List.of("El árbol generoso — Shel Silverstein", "La vasija agrietada (cuento popular)")),
                new E("enojo", "Enojo", "😠", "#E53E3E", "#FFF5F5",
                        "El enojo surge cuando sentimos que algo es injusto o cuando algo importante para nosotros es amenazado.",
                        "Puede verse en tensión muscular, voz elevada, dificultad para escuchar.",
                        List.of("¿Qué te hace enojar?", "¿Qué haces con tu cuerpo cuando te enojas?", "¿Cómo te tranquilizas?"),
                        List.of("Respiración del globo", "El semáforo de las emociones", "Botella de la calma"),
                        List.of("¡Fernando Furioso! — Hiawyn Oram", "Vaya rabieta — Mireille d'Allancé")),
                new E("miedo", "Miedo", "😨", "#7C3AED", "#F5F0FF",
                        "El miedo nos alerta ante situaciones de peligro real o percibido, protegiéndonos.",
                        "Puede verse en parálisis, llanto, evitar situaciones o buscar refugio.",
                        List.of("¿A qué le tienes miedo?", "¿Qué haces cuando sientes miedo?", "¿Quién te ayuda cuando tienes miedo?"),
                        List.of("Mapa de mis miedos", "El cofre del valor", "Dibuja un escudo protector"),
                        List.of("Donde viven los monstruos — Maurice Sendak", "El monstruo de colores — Anna Llenas")),
                new E("frustracion", "Frustración", "😤", "#DD6B20", "#FFFAF0",
                        "La frustración aparece cuando no podemos lograr algo que queremos o cuando nos bloqueamos.",
                        "Puede verse en rendirse rápido, reacciones impulsivas o dificultad para pedir ayuda.",
                        List.of("¿Cuándo te frustraste recientemente?", "¿Qué hiciste?", "¿Cómo puedes pedir ayuda cuando algo se te hace difícil?"),
                        List.of("El paso a paso para no rendirme", "Lista de pequeñas metas", "Juego de intentarlo de nuevo"),
                        List.of("La pequeña oruga glotona — Eric Carle", "Lo que escuchó la mariquita (cuento de constancia)")),
                new E("verguenza", "Vergüenza", "😳", "#D53F8C", "#FFF5FA",
                        "La vergüenza surge cuando sentimos que hemos fallado ante los demás o que no somos suficientes.",
                        "Puede verse en evitar hablar, esconderse, no querer participar.",
                        List.of("¿Cuándo sentiste vergüenza?", "¿Qué piensas de ti mismo en ese momento?", "¿Qué te gustaría que los demás supieran?"),
                        List.of("Mis cualidades en un espejo", "Círculo de aprecio del grupo", "Diario de mis logros"),
                        List.of("Orejas de mariposa — Luisa Aguilar", "El patito feo — Hans Christian Andersen")),
                new E("decepcion", "Decepción", "😞", "#718096", "#F7FAFC",
                        "La decepción ocurre cuando la realidad no cumple nuestras expectativas.",
                        "Puede verse en resignación, tristeza tranquila, o pérdida de motivación.",
                        List.of("¿Qué esperabas que pasara?", "¿Cómo te sentiste cuando no fue así?", "¿Qué aprendiste de eso?"),
                        List.of("De la expectativa al aprendizaje", "Caja de los planes B", "Conversación sobre intentar otra vez"),
                        List.of("Por cuatro esquinitas de nada — Jérôme Ruillier", "El jardín curioso — Peter Brown")),
                new E("ansiedad", "Ansiedad", "😰", "#38A169", "#F0FFF4",
                        "La ansiedad es una preocupación intensa ante situaciones futuras o inciertas.",
                        "Puede verse en dificultad para concentrarse, nerviosismo, quejas físicas.",
                        List.of("¿Qué te preocupa mucho?", "¿Qué pasa en tu cuerpo cuando te sientes ansioso?", "¿Qué te ayuda a calmarte?"),
                        List.of("Respiración 4-4-4", "Frasco de las preocupaciones", "Anclaje de los 5 sentidos"),
                        List.of("Tranquilos — Lemniscates", "Respira — Inês Castel-Branco")));

        for (E e : emotions) {
            Emotion emotion = new Emotion();
            emotion.setId(e.id());
            emotion.setName(e.name());
            emotion.setEmoji(e.emoji());
            emotion.setColor(e.color());
            emotion.setBg(e.bg());
            emotionRepository.save(emotion);

            EmotionContent content = new EmotionContent();
            content.setEmotionId(e.id());
            content.setDescription(e.description());
            content.setClassroom(e.classroom());
            content.setQuestions(e.questions());
            // El semillero solo conoce el nombre de cada actividad: propósito,
            // duración, edades, materiales y pasos son contenido pedagógico que
            // escribe Sueños y Letras desde el CMS, no algo que se pueda dar por
            // supuesto aquí.
            content.setActivities(e.activities().stream()
                    .map(title -> new EmotionActivity(title, "", "", "", "", List.of(), List.of()))
                    .toList());
            // Story titles used to be plain text; real story files are now
            // uploaded by an admin via the CMS, so seed with no files yet.
            content.setStories(List.of());
            emotionContentRepository.save(content);
        }
    }

    // El contenido de Aprendiendo ya NO se siembra aqui.
    //
    // Lo escribe V15__learning_content_2026.sql, y con eso el guard
    // `topicRepository.count() > 0` de este metodo nunca podria ser falso:
    // Flyway corre antes que el contexto de Spring, asi que para cuando el
    // seeder mira ya hay tres temas. El unico escenario donde llegaria a
    // ejecutarse —una base donde alguien borro los temas a mano— es
    // precisamente aquel en el que estaria equivocado, porque sembraria el
    // resumen viejo contradiciendo a la migracion sin que nadie lo notara.

    private void seedTools() {
        if (toolsContentRepository.count() > 0) return;
        ToolsContentEntity tools = new ToolsContentEntity();
        // Downloadable labels used to be plain text with no real file behind
        // them; real files are now uploaded by an admin via the CMS.
        tools.setDownloadables(List.of());
        tools.setActivityGuides(List.of());
        tools.setBibliography(List.of(
                "El cerebro del niño — Daniel J. Siegel y Tina Payne Bryson",
                "Educar las emociones — Mireia Cabero",
                "Emocionario — Cristina Núñez Pereira",
                "La inteligencia emocional — Daniel Goleman"));
        toolsContentRepository.save(tools);
    }

    private void seedPosts() {
        if (postRepository.count() > 0) return;
        // GCP-07: los posts y los eventos de ejemplo apuntan por clave foránea a
        // los usuarios de ejemplo (u-ana, u-lucia, u-sofia). Sin usuarios, este
        // insert viola posts_author_user_id_fkey y ABORTA EL ARRANQUE.
        //
        // Y no tener usuarios es justo lo que pasa en producción: SEED_USER_PASSWORD
        // se deja sin setear a propósito (SEC-02), así que seedUsers() se salta. O
        // sea que este seeder solo funcionaba en los entornos donde hay cuentas de
        // ejemplo, y rompía el primer arranque contra una base vacía —exactamente
        // el primer despliegue en Cloud SQL—. Se detectó levantando la imagen de
        // producción contra un Postgres limpio.
        if (demoUsersMissing("u-ana", "u-lucia", "u-sofia", "u-maria", "u-admin")) return;

        Post p1 = post("u-ana", "Maestra Ana", "@ana_maestro", true, "#7C3AED", "alegria",
                "¡Trabajamos la alegría con mi grupo! 🎉 Los niños aprendieron palabras nuevas: alegría, sonrisa, abrazo... ¿Cuál es su favorita? 📚", 12, 2);
        postRepository.save(p1);
        commentRepository.save(comment(p1.getId(), "Coordinadora Lucía", "CL", "#D97706", "¡Qué maravilla! Mi grupo favoritó 'abrazo' 🤗"));
        commentRepository.save(comment(p1.getId(), "Prof. Roberto", "PR", "#2B6CB0", "Excelente trabajo Ana, se nota el progreso."));

        Post p2 = post("u-lucia", "Coordinadora Lucía", "@lucia_coord", true, "#D97706", null,
                "Recordatorio: lectura grupal mañana a las 10:00 AM. ¡No olviden traer sus libros favoritos! 📖✨", 8, 3);
        postRepository.save(p2);
        commentRepository.save(comment(p2.getId(), "Maestra Ana", "MA", "#7C3AED", "¡Ahí estaremos! 🙌"));

        Post p3 = post("u-sofia", "Prof. Roberto", "@roberto_lee", false, "#2B6CB0", "enojo",
                "Conversamos sobre el enojo hoy. Es importante que los niños aprendan a reconocer y expresar esta emoción de forma sana. 💙", 15, 5);
        postRepository.save(p3);

        Post p4 = post("u-maria", "Mamá de Sofía", "@familia_sofia", false, "#DD6B20", "alegria",
                "Mi hija no para de hablar de las historias que leyeron en clase. ¡Gracias por inspirar el amor por la lectura! ❤️", 24, 7);
        postRepository.save(p4);
        commentRepository.save(comment(p4.getId(), "Maestra Ana", "MA", "#7C3AED", "¡Eso nos llena de alegría! 🥰"));

        Post p5 = post("u-admin", "Director Carlos", "@dir_carlos", true, "#319795", null,
                "Orgulloso del equipo de Sueños y Letras. Cada día acercamos más letras a más niños. ¡Más letras, más libres! 🌟", 42, 12);
        postRepository.save(p5);
    }

    private Post post(String authorUserId, String userName, String handle, boolean verified, String avatarBg,
                       String module, String text, int likes, int reposts) {
        Post p = new Post();
        p.setAuthorUserId(authorUserId);
        p.setUserName(userName);
        p.setHandle(handle);
        p.setVerified(verified);
        p.setAvatarBg(avatarBg);
        p.setModule(module);
        p.setText(text);
        p.setLikesCount(likes);
        p.setReposts(reposts);
        p.setAttachments(List.of());
        return p;
    }

    private Comment comment(Long postId, String userName, String initials, String avatarBg, String text) {
        Comment c = new Comment();
        c.setPostId(postId);
        c.setUserName(userName);
        c.setInitials(initials);
        c.setAvatarBg(avatarBg);
        c.setText(text);
        return c;
    }

    private void seedEvents() {
        if (calendarEventRepository.count() > 0) return;
        String owner = "u-maria";
        // Mismo motivo que en seedPosts(): owner es una FK a users.
        if (demoUsersMissing(owner)) return;
        calendarEventRepository.saveAll(List.of(
                event(owner, "Sesión de lectura Grupo 1", EventType.SESION, LocalDate.of(2026, 6, 4), "10:00", "11:00", "30 minutos antes", null),
                event(owner, "Preparar material del módulo", EventType.TAREA, LocalDate.of(2026, 6, 4), "13:00", "13:30", "ninguno", false),
                event(owner, "Actividad Grupo 2", EventType.SESION, LocalDate.of(2026, 6, 4), "14:00", "15:00", "10 minutos antes", null),
                event(owner, "Audiocuento con Grupo 3", EventType.SESION, LocalDate.of(2026, 6, 4), "16:30", "17:30", "1 hora antes", null),
                event(owner, "Reunión de coordinación", EventType.EVENTO, LocalDate.of(2026, 6, 6), "09:00", "10:30", "1 día antes", null),
                event(owner, "Entregar informe mensual", EventType.TAREA, LocalDate.of(2026, 6, 9), "15:00", "15:30", "ninguno", false)));
    }

    private CalendarEvent event(String ownerUserId, String title, EventType type, LocalDate date,
                                 String startTime, String endTime, String reminder, Boolean completed) {
        CalendarEvent e = new CalendarEvent();
        e.setId(java.util.UUID.randomUUID().toString());
        e.setOwnerUserId(ownerUserId);
        e.setTitle(title);
        e.setType(type);
        e.setDate(date);
        e.setStartTime(startTime);
        e.setEndTime(endTime);
        e.setReminder(reminder);
        e.setCompleted(completed);
        return e;
    }
}

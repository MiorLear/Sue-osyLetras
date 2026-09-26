package com.explorarte.api.auth;

import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.explorarte.api.invitation.InvitationCheckDto;
import com.explorarte.api.invitation.InvitationService;
import com.explorarte.api.security.AuthRateLimiter;
import com.explorarte.api.security.AuthenticatedUserCache;
import com.explorarte.api.security.JwtService;
import com.explorarte.api.user.User;
import com.explorarte.api.user.UserRepository;
import com.explorarte.api.user.UserRole;
import com.explorarte.api.user.UserStatus;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/**
 * Auth endpoints. Password reset sends a real, random, expiring code by email
 * (see {@link EmailService} / Resend).
 *
 * <p>No code is ever logged and there is no fixed "dev" code (SEC-04 / SEC-10) —
 * read {@code verification_codes} directly when testing locally.
 *
 * <p>El acceso por telefono (SMS/OTP) se retiro: nunca llego a tener proveedor
 * de SMS y la unica forma de entrar sin correo era un codigo que no se enviaba.
 * Queda una sola credencial por cuenta, el correo, con Google como atajo.
 */
@RestController
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final VerificationCodeService verificationCodeService;
    private final EmailService emailService;
    private final AuthRateLimiter rateLimiter;
    private final AuthenticatedUserCache userCache;
    private final FirebaseAuth firebaseAuth;
    private final InvitationService invitationService;

    @Autowired
    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            VerificationCodeService verificationCodeService,
            EmailService emailService,
            AuthRateLimiter rateLimiter,
            AuthenticatedUserCache userCache,
            FirebaseAuth firebaseAuth,
            InvitationService invitationService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.verificationCodeService = verificationCodeService;
        this.emailService = emailService;
        this.rateLimiter = rateLimiter;
        this.userCache = userCache;
        this.firebaseAuth = firebaseAuth;
        this.invitationService = invitationService;
    }

    /** Kept for focused unit tests that do not exercise Firebase authentication. */
    AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            VerificationCodeService verificationCodeService,
            EmailService emailService,
            AuthRateLimiter rateLimiter,
            AuthenticatedUserCache userCache) {
        this(userRepository, passwordEncoder, jwtService, verificationCodeService, emailService,
                rateLimiter, userCache, null, null);
    }

    /** Exchanges a verified Firebase Google identity for the normal app session. */
    @PostMapping("/auth/firebase")
    public AuthResultDto firebaseLogin(@Valid @RequestBody FirebaseAuthInput input) {
        final FirebaseToken token;
        try {
            token = firebaseAuth.verifyIdToken(input.idToken(), true);
        } catch (IllegalArgumentException ex) {
            log.warn("Token de Firebase con forma inválida: {}", ex.getMessage());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Firebase token");
        } catch (FirebaseAuthException ex) {
            throw verificationFailure(ex);
        }

        String email = clean(token.getEmail());
        // Sin correo no hay cuenta: antes una identidad de solo telefono entraba
        // por aqui y se le inventaba un correo sintetico.
        if (email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Firebase identity has no email");
        }

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseGet(() -> createFirebaseUser(token, email, input));
        return authResult(user);
    }

    /**
     * Traduce un fallo de verificación a la respuesta que toca.
     *
     * <p>{@code verifyIdToken(_, true)} pide comprobar la revocación, y eso es
     * una llamada autenticada a Identity Toolkit. Si a la cuenta con la que
     * corre el servicio le falta el rol de Firebase Authentication, esa llamada
     * lanza y con ella se caen TODOS los tokens, los buenos también: no es una
     * credencial mala, es la instalación rota.
     *
     * <p>Devolver eso como 401 tenía una consecuencia que no se ve desde aquí:
     * el cliente lo trata como sesión inválida, borra el token y salta a
     * {@code /login} (ver {@code onUnauthorized} en {@code web/src/lib/api.ts}).
     * Un alta con Google a medio llenar se perdía entera, y la persona acababa
     * en el login probando una contraseña que su cuenta nunca tuvo, porque las
     * cuentas creadas con Google reciben una aleatoria.
     *
     * <p>El SDK solo rellena {@code AuthErrorCode} cuando el problema es del
     * token —caducado, revocado, mal firmado—. Un permiso que falta, una red
     * caída o un 5xx de Google llegan con ese campo vacío y el motivo en
     * {@code ErrorCode}. Esa es la línea que separa las dos respuestas.
     *
     * <p>Y en los dos casos se registra: hasta ahora el {@code catch} se comía
     * la excepción, así que una caída total del acceso con Google no dejaba una
     * sola línea en los logs.
     */
    static ResponseStatusException verificationFailure(FirebaseAuthException ex) {
        if (ex.getAuthErrorCode() == null) {
            log.error("No se pudo verificar el token de Firebase ({}). Revisa que la cuenta de"
                    + " servicio de Cloud Run tenga un rol de Firebase Authentication.",
                    ex.getErrorCode(), ex);
            return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "No se pudo verificar la identidad. Intenta de nuevo en un momento.");
        }
        log.warn("Token de Firebase rechazado: {}", ex.getAuthErrorCode());
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Firebase token");
    }

    private User createFirebaseUser(FirebaseToken token, String email, FirebaseAuthInput input) {
        User user = new User();
        user.setId("u-" + UUID.randomUUID());
        String displayName = clean(token.getName());
        String suppliedName = clean(input.name());
        String suppliedLastname = clean(input.lastname());
        if (suppliedName.isBlank() && !displayName.isBlank()) {
            int split = displayName.indexOf(' ');
            suppliedName = split < 0 ? displayName : displayName.substring(0, split);
            suppliedLastname = split < 0 ? "" : displayName.substring(split + 1);
        }
        user.setName(suppliedName.isBlank() ? "Usuario" : suppliedName);
        user.setLastname(suppliedLastname);
        user.setEmail(email.toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setInstitucion(User.INSTITUCION_POR_DEFECTO);
        user.setUbicacion(clean(input.ubicacion()));
        user.setPhoto(clean(token.getPicture()));
        user.setRole(UserRole.TEACHER);
        user.setStatus(UserStatus.APPROVED);
        // Con Google no se piden ni el nombre real ni la ubicacion, asi que una
        // cuenta invitada llega a medio llenar y hay que pedirle que la termine.
        user.setProfileCompleted(!acceptInvitation(input.invitationToken(), email, user.getId()));
        return userRepository.save(user);
    }

    /**
     * Consume el token de invitacion, si lo hay y sirve para ese correo.
     *
     * @return true si el alta venia de una invitacion aceptada.
     */
    private boolean acceptInvitation(String token, String email, String userId) {
        if (invitationService == null || token == null || token.isBlank()) return false;
        return invitationService.accept(token, email, userId).isPresent();
    }

    /**
     * Lo que la pantalla de alta necesita saber de un enlace de invitacion.
     *
     * <p>Vive bajo {@code /auth/} y no bajo {@code /admin/} porque quien lo abre
     * todavia no tiene cuenta; de paso hereda el limite por IP de
     * {@code AuthRateLimitFilter}, que es lo que hace que adivinar tokens no sea
     * una estrategia. Un token que no sirve responde siempre igual, sin decir si
     * no existe, caduco, ya se uso o se revoco.
     */
    @GetMapping("/auth/invitations/{token}")
    public InvitationCheckDto checkInvitation(@PathVariable @Size(max = 200) String token) {
        if (invitationService == null) return InvitationCheckDto.invalid();
        return invitationService.usable(token)
                .map(invitation -> new InvitationCheckDto(true, invitation.getEmail()))
                .orElseGet(InvitationCheckDto::invalid);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    @PostMapping("/auth/login")
    public AuthResultDto login(@Valid @RequestBody LoginInput input) {
        // Per-IP throttling already happened in AuthRateLimitFilter; this second budget is
        // per account, so a distributed guessing run against one inbox is throttled too.
        rateLimiter.checkIdentifier("login", input.email());
        String password = input.password() == null ? "" : input.password();
        User user = userRepository.findByEmailIgnoreCase(input.email() == null ? "" : input.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        // SEC-16 / CVE-2025-22228: never hand BCrypt more than it compares. No account can
        // hold a password this long (registration and reset both refuse one), so this is
        // wrong credentials rather than a validation error — same answer, no oracle.
        if (PasswordPolicy.exceedsMaximum(password)
                || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return authResult(user);
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResultDto register(@Valid @RequestBody RegisterInput input) {
        String email = input.email() == null ? "" : input.email().trim();

        // SEC-13: sin el alta por telefono queda una sola regla cruzada — correo y
        // contrasena van juntos. Antes una contrasena vacia se sustituia en silencio
        // por un UUID, creando cuentas en las que nadie podia entrar nunca.
        if (email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Se requiere un correo para crear la cuenta");
        }
        if (!PasswordPolicy.isPresent(input.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Se requiere una contraseña para registrarse con correo. " + PasswordPolicy.REQUIREMENTS);
        }
        if (!PasswordPolicy.isAcceptable(input.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, PasswordPolicy.REQUIREMENTS);
        }

        // SEC-13: a duplicate used to reach the database and come back as a bare 500.
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una cuenta con ese correo");
        }

        User user = new User();
        user.setId("u-" + UUID.randomUUID());
        user.setName(input.name());
        user.setLastname(input.lastname());
        user.setInstitucion(User.INSTITUCION_POR_DEFECTO);
        user.setUbicacion(input.ubicacion());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(input.password()));
        user.setRole(UserRole.TEACHER);
        // Registration auto-approves, matching the existing mock's behavior; the
        // admin console remains available to reject/suspend accounts afterwards.
        user.setStatus(UserStatus.APPROVED);
        // El alta por correo si pide nombre, apellido y ubicacion, pero una
        // cuenta invitada sigue sin foto y conviene que pase por su perfil.
        user.setProfileCompleted(!acceptInvitation(input.invitationToken(), email, user.getId()));
        userRepository.save(user);
        return authResult(user);
    }

    @PostMapping("/auth/forgot-password")
    public SentResponse forgotPassword(@Valid @RequestBody ForgotPasswordInput input) {
        rateLimiter.checkIdentifier("forgot-password", input.emailOrPhone());
        // Always return sent:true regardless of whether the account exists, so this
        // endpoint can't be used to discover which emails/phones are registered.
        Optional<User> user = findByEmail(input.emailOrPhone());
        if (user.isPresent()) {
            String code = verificationCodeService.issue(input.emailOrPhone());
            String email = user.get().getEmail();
            if (isDeliverableEmail(email)) {
                boolean sent = emailService.sendPasswordResetLink(email, input.emailOrPhone(), code);
                if (!sent) {
                    // A delivery failure logs WHO and WHAT FAILED, never the code itself
                    // (SEC-10). Render retains these logs and shows them in the dashboard.
                    log.warn("[forgot-password] reset email to {} was not delivered", email);
                }
            } else {
                // Cuenta heredada con correo sintetico (@sinemail.explorarte) de cuando
                // existia el alta por telefono: no hay buzon al que escribir.
                log.info("[forgot-password] no deliverable email for the requested account");
            }
        } else {
            log.info("[forgot-password] no account matched the request");
        }
        return SentResponse.ok();
    }

    @PostMapping("/auth/reset-password")
    public SentResponse resetPassword(@Valid @RequestBody ResetPasswordInput input) {
        rateLimiter.checkIdentifier("reset-password", input.emailOrPhone());
        if (!verificationCodeService.verify(input.emailOrPhone(), input.code())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid code");
        }
        // SEC-13 / SEC-16: the hand-rolled `length() < 6` check is replaced by the single
        // policy registration also applies, including the byte-level maximum BCrypt needs.
        if (!PasswordPolicy.isAcceptable(input.newPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, PasswordPolicy.REQUIREMENTS);
        }
        User user = findByEmail(input.emailOrPhone())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setPasswordHash(passwordEncoder.encode(input.newPassword()));
        // A password change must end every session opened with the old one (SEC-09).
        user.revokeIssuedTokens();
        userRepository.save(user);
        userCache.invalidate(user.getId());
        verificationCodeService.consume(input.emailOrPhone());
        return SentResponse.ok();
    }

    /**
     * Ends the caller's sessions. SEC-09: before this there was no revocation path at all —
     * a token stayed usable for its full 24 hours no matter what happened to the account.
     *
     * <p>Bumping the token version invalidates every token this account holds, on every
     * device, not just the one presenting the request.
     */
    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof String userId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        userRepository.findById(userId).ifPresent(user -> {
            user.revokeIssuedTokens();
            userRepository.save(user);
            userCache.invalidate(user.getId());
        });
    }

    /**
     * El campo del cuerpo sigue llamandose {@code emailOrPhone} para no romper a
     * los clientes ya desplegados, pero desde que no hay acceso por telefono lo
     * unico que se busca es el correo.
     */
    private Optional<User> findByEmail(String identifier) {
        String idf = identifier == null ? "" : identifier.trim();
        return idf.isEmpty() ? Optional.empty() : userRepository.findByEmailIgnoreCase(idf);
    }

    private static boolean isDeliverableEmail(String email) {
        return email != null && email.contains("@") && !email.endsWith("@sinemail.explorarte");
    }

    /**
     * Issues a token — and only ever after {@link #requireActive(User)}. SEC-01: the admin
     * approve/reject workflow used to have no server-side effect because this was reached
     * without ever reading {@code user.getStatus()}.
     */
    private AuthResultDto authResult(User user) {
        requireActive(user);
        String token = jwtService.generate(user.getId(), user.getRole().name(), user.getTokenVersion());
        return new AuthResultDto(token, user.toDto());
    }

    /** Refuses to authenticate an account that an admin has not approved, or has rejected. */
    private static void requireActive(User user) {
        if (user.getStatus() != UserStatus.APPROVED) {
            throw new AccountNotActiveException(user.getStatus());
        }
    }
}

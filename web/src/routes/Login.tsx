import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, type AuthResult, type UserStatus } from '@explorarte/shared';
import { GoogleIcon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { ErrorNote, Field, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api, usingMock } from '@/lib/api';
import { describeAuthError } from '@/lib/auth-errors';
import { finishGoogleSignIn, startGoogleSignIn } from '@/lib/firebase-auth';
import { activateWaitingServiceWorker, refreshServiceWorkerForAuthScreen } from '@/lib/sw-activate';

// Seeded demo accounts (mock mode only). Any password works; role/status are
// resolved by email — see shared/src/api/mock/seed.ts.
const DEMO_ACCOUNTS = [
  { label: 'Administrador', emoji: '🛠️', email: 'admin@explorarte.org' },
  { label: 'Docente', emoji: '👩‍🏫', email: 'maria@ejemplo.com' },
] as const;

/**
 * El servidor rechaza una cuenta no aprobada con 403 y un cuerpo problem+json que
 * trae `code` y `accountStatus` (SEC-01). Antes esa comprobación vivía solo aquí,
 * leyendo `user.status` de un 200 — y por eso se saltaba llamando a /auth/login
 * con curl. Ahora el 200 ni siquiera llega para esas cuentas.
 */
function accountStatusFrom403(err: unknown): UserStatus | null {
  if (!(err instanceof ApiError) || err.status !== 403) return null;
  try {
    const body = JSON.parse(err.body) as { code?: string; accountStatus?: string };
    if (body.code === 'ACCOUNT_REJECTED') return 'rejected';
    if (body.code === 'ACCOUNT_PENDING') return 'pending';
  } catch {
    // Cuerpo no-JSON: cae al mensaje genérico de abajo.
  }
  return null;
}

function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
  }
  // 429: la API ahora limita los intentos y manda Retry-After (SEC-05).
  if (err.status === 429) {
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  }
  if (err.status === 401) return 'Correo o contraseña incorrectos.';
  if (err.status === 400) return 'Revisa los datos ingresados.';
  return 'Algo salió mal. Intenta de nuevo en un momento.';
}

export default function Login() {
  const navigate = useNavigate();
  // A donde iba antes de que la sesion caducara (lo deja RequireAuth). Solo
  // rutas internas: nada que empiece por // ni fuera de la app.
  const from = (useLocation().state as { from?: string } | null)?.from;
  const returnTo = from && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : null;
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const showPendingScreen = useCallback((status: UserStatus) =>
    navigate('/pendiente', { replace: true, state: { status } }), [navigate]);

  // La comprobación de estado se conserva para el modo mock, que resuelve la
  // cuenta en memoria y devuelve 200 con el status dentro. Contra la API real
  // esta rama ya no se alcanza: el servidor responde 403 (ver failed()).
  const enter = useCallback(async (result: AuthResult) => {
    setError(null);
    const u = result.user;
    if (u.status === 'rejected' || u.status === 'pending') {
      showPendingScreen(u.status);
      return;
    }
    await signIn(result);
    const home = u.role === 'admin' ? '/admin' : '/main';
    // Una docente no vuelve a /admin aunque viniera de ahi: RequireRole la
    // rebotaria igual, pero asi no pasa por la pantalla de carga.
    const back = returnTo && (u.role === 'admin' || !returnTo.startsWith('/admin')) ? returnTo : null;
    navigate(back ?? home, { replace: true });
  }, [navigate, returnTo, showPendingScreen, signIn]);

  /** Una cuenta no aprobada va a su pantalla; el resto de errores se muestran. */
  const failed = useCallback((err: unknown) => {
    // El código crudo es lo único que permite diagnosticar un fallo desde el
    // teléfono de una docente sin reproducir su navegador.
    console.error('[login]', err);
    const blockedStatus = accountStatusFrom403(err);
    if (blockedStatus) {
      showPendingScreen(blockedStatus);
      return;
    }
    // Un fallo de Firebase (popup bloqueado, ventana cerrada...) no es un fallo
    // del servidor, y decir lo contrario manda a la usuaria a revisar su wifi.
    const authDisplay = describeAuthError(err);
    if (authDisplay) {
      if (authDisplay.kind === 'message') setError(authDisplay.message);
      return;
    }
    setError(messageFor(err));
  }, [showPendingScreen]);

  // Dos cosas en el arranque, y el orden entre ellas no es indiferente.
  //
  // Primero se recoge la vuelta de Google, porque es la única oportunidad: la
  // página que lanzó la redirección ya no existe y el resultado se lee una vez.
  // `refreshServiceWorkerForAuthScreen` puede llamar a `location.reload()`, y
  // una recarga antes de leerlo tiraría el token sin dejar rastro.
  //
  // Ese relevo del worker existe porque uno anterior al denylist de `/__/`
  // responde las páginas de Firebase con el shell de la app y rompe el acceso
  // con Google. Aquí no hay trabajo sin guardar, así que se puede forzar sin
  // preguntar; el resto de la app sigue esperando a que la usuaria pulse
  // "Actualizar".
  const arrancado = useRef(false);
  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    void (async () => {
      let idToken: string | null = null;
      try {
        idToken = await finishGoogleSignIn();
      } catch (err) {
        failed(err);
      }
      if (!idToken) {
        // Sin nada pendiente que perder, ahora sí.
        void refreshServiceWorkerForAuthScreen();
        return;
      }
      setGoogleLoading(true);
      try {
        await enter(await api.auth.firebase({ idToken }));
      } catch (err) {
        failed(err);
        setGoogleLoading(false);
      }
    })();
  }, [enter, failed]);

  const signInWithGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      // Corto y sin red: el permiso para abrir el popup sobrevive a la espera.
      await activateWaitingServiceWorker({ timeoutMs: 400 });
      const google = await startGoogleSignIn();
      // La pestaña se va a Google y esta página deja de existir. El botón se
      // queda en "Conectando..." a propósito: apagarlo sería prometer que algo
      // volvió cuando lo que viene es una navegación.
      if (google.kind === 'redirecting') return;
      await enter(await api.auth.firebase({ idToken: google.idToken }));
    } catch (err) {
      failed(err);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <Logo size={56} />
          <h1 style={{ marginTop: 12, fontSize: 21, fontWeight: 800, color: 'var(--text-dark)', textAlign: 'center' }}>
            Inicia sesión en ExplorArte
          </h1>
          <p style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
            Accede a tus recursos y continúa explorando.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GoogleButton
            label={googleLoading ? 'Conectando con Google...' : 'Continuar con Google'}
            onClick={signInWithGoogle}
            disabled={googleLoading}
          />
          <Divider />
          <Field label="Correo electrónico" icon="mail" placeholder="correo@ejemplo.com" type="email" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <Field label="Contraseña" password placeholder="Tu contraseña" value={password} onChangeText={setPassword} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="tap-44" onClick={() => navigate('/forgot-password')} style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <PrimaryButton label="Iniciar sesión" onClick={() => api.auth.login({ email, password }).then(enter).catch(failed)} disabled={!email || !password} />
          <ErrorNote message={error} />

          {usingMock ? (
            <div style={{ marginTop: 4, padding: 14, borderRadius: 14, background: 'var(--nav-bg)', border: '1px solid #DCEDEA' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--brand-dark)', marginBottom: 8 }}>
                Cuentas de demostración
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    onClick={() => {
                      setEmail(a.email);
                      setPassword('demo1234');
                    }}
                    className="pressable"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 8px', borderRadius: 11, background: '#fff', border: '1px solid var(--border-soft)' }}>
                    <span style={{ fontSize: 18 }}>{a.emoji}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-dark)' }}>{a.label}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{a.email}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                Toca una cuenta y presiona "Iniciar sesión" · cualquier contraseña funciona
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ padding: '24px 0 0', textAlign: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            ¿Primera vez en ExplorArte?{' '}
            <button className="tap-44" onClick={() => navigate('/register')} style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 12.5 }}>
              Crear mi cuenta
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border-input)' }} />
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>o con correo</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border-input)' }} />
    </div>
  );
}

function GoogleButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pressable"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14, borderRadius: 12, background: '#fff', border: '1.5px solid var(--border-soft)', fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>
      <GoogleIcon size={22} />
      {label}
    </button>
  );
}

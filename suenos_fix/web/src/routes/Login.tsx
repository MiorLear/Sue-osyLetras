import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, type AuthResult, type UserStatus } from '@explorarte/shared';
import { GoogleIcon, Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Field, PrimaryButton } from '@/components/ui';
import { toast } from '@/components/toast-store';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

type ViewKind = 'main' | 'phone-number' | 'phone-otp';

const TITLES: Record<ViewKind, string> = {
  main: 'Bienvenida de nuevo',
  'phone-number': 'Ingresa tu teléfono',
  'phone-otp': 'Verificar número',
};

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
  const { signIn } = useAuth();
  const [view, setView] = useState<ViewKind>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showPendingScreen = (status: UserStatus) =>
    navigate('/pendiente', { replace: true, state: { status } });

  // La comprobación de estado se conserva para el modo mock, que resuelve la
  // cuenta en memoria y devuelve 200 con el status dentro. Contra la API real
  // esta rama ya no se alcanza: el servidor responde 403 (ver failed()).
  const enter = (result: AuthResult) => {
    setError(null);
    const u = result.user;
    if (u.status === 'rejected' || u.status === 'pending') {
      showPendingScreen(u.status);
      return;
    }
    signIn(result);
    navigate(u.role === 'admin' ? '/admin' : '/main', { replace: true });
  };

  /** Una cuenta no aprobada va a su pantalla; el resto de errores se muestran. */
  const failed = (err: unknown) => {
    const blockedStatus = accountStatusFrom403(err);
    if (blockedStatus) {
      showPendingScreen(blockedStatus);
      return;
    }
    setError(messageFor(err));
  };

  const subtitle =
    view === 'main'
      ? 'Sueños y Letras · más letras, más libres'
      : view === 'phone-number'
      ? 'Te enviaremos un código de 6 dígitos'
      : 'Código enviado a ' + phone;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {view !== 'main' ? (
          <button onClick={() => setView('main')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-body)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            <Icon name="arrow-left" size={18} color="var(--text-body)" /> Volver
          </button>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <Logo size={56} />
          <h1 style={{ marginTop: 12, fontSize: 21, fontWeight: 800, color: 'var(--text-dark)', textAlign: 'center' }}>{TITLES[view]}</h1>
          <p style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>{subtitle}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {view === 'main' ? (
            <>
              <SocialButton kind="google" label="Continuar con Google" onClick={() => toast.info('El inicio de sesión con Google estará disponible muy pronto. Por ahora usa tu correo.', { title: 'Próximamente' })} />
              <SocialButton kind="phone" label="Continuar con teléfono" onClick={() => setView('phone-number')} />
              <Divider />
              <Field label="Correo electrónico" icon="mail" placeholder="correo@ejemplo.com" type="email" autoCapitalize="none" value={email} onChangeText={setEmail} />
              <Field label="Contraseña" password placeholder="Tu contraseña" value={password} onChangeText={setPassword} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => toast.info('La recuperación de contraseña estará disponible muy pronto. Por ahora, si olvidaste tu contraseña, contacta al administrador.', { title: 'Próximamente' })} style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <PrimaryButton label="Iniciar sesión" onClick={() => api.auth.login({ email, password }).then(enter).catch(failed)} disabled={!email || !password} />
              <ErrorNote message={error} />

            </>
          ) : null}

          {view === 'phone-number' ? (
            <>
              <Field label="Número de teléfono" icon="phone" placeholder="+502 1234 5678" value={phone} onChangeText={setPhone} />
              <PrimaryButton label="Enviar código" onClick={() => api.auth.requestOtp(phone).then(() => { setError(null); setView('phone-otp'); }).catch(failed)} disabled={phone.length < 8} />
              <ErrorNote message={error} />
            </>
          ) : null}

          {view === 'phone-otp' ? (
            <>
              <div style={{ borderRadius: 16, padding: 16, textAlign: 'center', background: '#E8F8F7', border: '1px solid #C0E8E5' }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-body)' }}>Código enviado a</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{phone}</div>
              </div>
              <label className="field-label">Código de 6 dígitos</label>
              <OtpInput value={otp} onChange={setOtp} />
              <PrimaryButton label="Verificar e iniciar sesión" onClick={() => api.auth.verifyOtp(phone, otp).then(enter).catch(failed)} disabled={otp.length < 6} />
              <ErrorNote message={error} />
              <button onClick={() => setView('phone-number')} className="center muted" style={{ fontSize: 12.5, padding: 8 }}>
                ¿No recibiste el código? <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Reenviar</span>
              </button>
            </>
          ) : null}
        </div>

        {view === 'main' ? (
          <div style={{ padding: '24px 0 0', textAlign: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              ¿No tienes cuenta?{' '}
              <button onClick={() => navigate('/register')} style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 12.5 }}>
                Registrarse
              </button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Antes de esto ninguna llamada de esta pantalla tenía .catch, así que una
 * contraseña incorrecta era una promesa rechazada sin capturar: el botón no hacía
 * nada y no se decía nada. Ahora que el servidor también responde 403, 429 y 400,
 * hace falta un sitio donde contarlo.
 */
function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{ padding: '10px 12px', borderRadius: 11, background: '#FFF5F5', border: '1px solid #FED7D7', fontSize: 12.5, color: '#C53030' }}>
      {message}
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

function SocialButton({ kind, label, onClick }: { kind: 'google' | 'phone'; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pressable"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14, borderRadius: 12, background: '#fff', border: '1.5px solid var(--border-soft)', fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>
      {kind === 'google' ? (
        <GoogleIcon size={22} />
      ) : (
        <span style={{ width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#7C3AED' }}>
          <Icon name="phone" size={13} color="#fff" />
        </span>
      )}
      {label}
    </button>
  );
}

export function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      maxLength={6}
      placeholder="••••••"
      style={{
        padding: 16,
        borderRadius: 12,
        textAlign: 'center',
        border: `1.5px solid ${value.length > 0 ? 'var(--brand)' : 'var(--border-input)'}`,
        background: '#fff',
        fontSize: 26,
        fontWeight: 800,
        color: 'var(--text-dark)',
        letterSpacing: 12,
        outline: 'none',
        width: '100%',
      }}
    />
  );
}

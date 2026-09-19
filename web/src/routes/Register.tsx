import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@explorarte/shared';
import { useSchools } from '@/lib/useSchools';
import { GoogleIcon, Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { ErrorNote, Field, LocationAutocomplete, PrimaryButton, SelectOrAdd } from '@/components/ui';
import { toast } from '@/components/toast-store';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { OtpInput } from './Login';
import { describeAuthError } from '@/lib/auth-errors';
import { confirmPhoneCode, requestPhoneCode, startGoogleSignIn } from '@/lib/firebase-auth';
import { activateWaitingServiceWorker, refreshServiceWorkerForAuthScreen } from '@/lib/sw-activate';
import type { ConfirmationResult } from 'firebase/auth';

type Method = 'google' | 'phone' | 'email' | null;
const TITLES = ['Crear cuenta', 'Verificar identidad', 'Tu información'];

/** Lo mismo que `PasswordPolicy.MIN_LENGTH` en la API, que es quien manda: si
 *  allí sube, aquí sube. Comprobarlo también en el cliente no es duplicar la
 *  validación por gusto — sin esto el rechazo llega dos pantallas más tarde,
 *  donde ya no está el campo que hay que corregir. */
const MIN_PASSWORD = 8;

/** El `detail` o el primer error de campo de un problem+json de la API.
 *
 *  El orden importa: ante un fallo de validación el `detail` es "The request
 *  body is not valid", que no le dice nada a nadie, mientras que `errors` trae
 *  el mensaje bueno ("La contraseña debe tener al menos 8 caracteres"). Las
 *  reglas que cruzan campos llegan al revés, con el mensaje en `detail` y sin
 *  `errors`. */
function detailOf(err: ApiError): string | null {
  try {
    const body = JSON.parse(err.body) as { detail?: string; errors?: Record<string, string> };
    const field = body.errors ? Object.values(body.errors)[0] : undefined;
    return field ?? body.detail ?? null;
  } catch {
    return null;
  }
}

/**
 * Qué decirle a la persona, y si hay que devolverla al paso del correo.
 *
 * El correo repetido (409) y la contraseña o el correo mal formados (400) son
 * los tres datos del paso 1. Dejar el aviso en el paso 3 la obligaría a
 * adivinar dónde está el campo que hay que corregir, porque ahí ya no se ve.
 */
function registerFailure(err: unknown): { message: string; backToCredentials: boolean } {
  if (!(err instanceof ApiError)) {
    return {
      message: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
      backToCredentials: false,
    };
  }
  if (err.status === 409) {
    return {
      message: 'Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.',
      backToCredentials: true,
    };
  }
  if (err.status === 400) {
    return { message: detailOf(err) ?? 'Revisa los datos ingresados.', backToCredentials: true };
  }
  if (err.status === 429) {
    return {
      message: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
      backToCredentials: false,
    };
  }
  return { message: 'Algo salió mal. Intenta de nuevo en un momento.', backToCredentials: false };
}

export default function Register() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const schools = useSchools();

  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method>(null);
  const [phoneStep, setPhoneStep] = useState<'number' | 'otp'>('number');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [institucion, setInstitucion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Igual que en Login: un service worker anterior al denylist de `/__/` rompe
  // el popup de Google, y aquí tampoco hay trabajo que se pueda perder.
  useEffect(() => {
    void refreshServiceWorkerForAuthScreen();
  }, []);

  // Los registros ya no necesitan aprobación: la cuenta queda activa y entra
  // directo a la app.
  //
  // El catch no es defensivo: es el único que hay en el camino. Sin él, un 409
  // por correo repetido o un 400 por contraseña corta eran una promesa
  // rechazada sin capturar, y el último botón del alta no hacía nada ni decía
  // nada. Login ya lo arregló en su momento; aquí se había quedado sin.
  const finishRegister = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = firebaseToken
        ? await api.auth.firebase({ idToken: firebaseToken, name, lastname, institucion, ubicacion })
        : await api.auth.register({ name, lastname, institucion, ubicacion, email, password, phone });
      await signIn(result);
      navigate('/main', { replace: true });
    } catch (err) {
      console.error('[registro] crear cuenta', err);
      const { message, backToCredentials } = registerFailure(err);
      setError(message);
      // Solo el alta por correo tiene un paso 1 al que volver: con Google o con
      // teléfono la credencial ya está resuelta y allí no hay nada que corregir.
      if (backToCredentials && method === 'email') setStep(1);
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => {
    if (step === 0) navigate('/login');
    else if (step === 1) { setStep(0); setMethod(null); }
    else setStep(1);
  };

  const choose = async (m: Method) => {
    if (m === 'google') {
      try {
        // Corto y sin red: el permiso para abrir el popup sobrevive a la espera.
        await activateWaitingServiceWorker({ timeoutMs: 400 });
        setFirebaseToken(await startGoogleSignIn());
        setMethod('google');
        setStep(2);
      } catch (err) {
        console.error('[registro] google', err);
        const display = describeAuthError(err);
        // Cerrar la ventana de Google es una decisión, no un fallo que anunciar.
        if (display?.kind === 'silent') return;
        toast.error(display?.message ?? 'No pudimos conectar con Google. Intenta de nuevo.');
      }
      return;
    }
    setMethod(m);
    setStep(1);
    setPhoneStep('number');
  };

  let subtitle = '';
  if (step === 0) subtitle = 'Elige cómo quieres registrarte';
  else if (step === 1 && method === 'email') subtitle = 'Ingresa tu correo y contraseña';
  else if (step === 1 && method === 'phone') subtitle = phoneStep === 'number' ? 'Ingresa tu número de teléfono' : 'Ingresa el código que recibiste';
  else if (step === 2) subtitle = 'Cuéntanos un poco sobre ti';

  return (
    <div className="auth-shell">
      <div className="auth-card wide">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <button aria-label="Volver" className="tap-44" onClick={back} style={{ borderRadius: 22, border: '1.5px solid var(--border-input)' }}>
          <Icon name="arrow-left" size={18} color="var(--text-body)" />
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: i === step ? 16 : 6, height: 6, borderRadius: 9, background: i <= step ? 'var(--brand)' : 'var(--border-input)' }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <Logo size={56} />
        <h1 style={{ marginTop: 12, fontSize: 21, fontWeight: 800, color: 'var(--text-dark)' }}>{TITLES[step]}</h1>
        <p style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>{subtitle}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Arriba del formulario y fuera de cada paso: el fallo puede devolver
            al paso del correo, y el aviso tiene que seguir visible al llegar. */}
        <ErrorNote message={error} />

        {step === 0 ? (
          <>
            <MethodCard iconBg="#FFF3E0" title="Continuar con Google" subtitle="Usa tu cuenta de Google" onClick={() => choose('google')} google />
            <MethodCard iconBg="#F5F0FF" iconColor="#7C3AED" icon="phone" title="Número de teléfono" subtitle="Recibirás un código de verificación" onClick={() => choose('phone')} />
            <MethodCard iconBg="#E8F8F7" iconColor="var(--brand)" icon="mail" title="Correo y contraseña" subtitle="Crea tu cuenta con email" onClick={() => choose('email')} />
          </>
        ) : null}

        {step === 1 && method === 'email' ? (
          <>
            <Field label="Correo electrónico" placeholder="correo@ejemplo.com" type="email" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <Field label="Contraseña" password placeholder="Mínimo 8 caracteres" value={password} onChangeText={setPassword} />
            <Field label="Confirmar contraseña" password placeholder="Repite tu contraseña" value={confirm} onChangeText={setConfirm} />
            {/* Un botón deshabilitado sin explicación es su propio problema: la
                persona reescribe la contraseña sin saber qué le falta. Va como
                texto normal y no como alerta porque cambia en cada tecla. */}
            {password && password.length < MIN_PASSWORD ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                La contraseña necesita al menos {MIN_PASSWORD} caracteres.
              </p>
            ) : confirm && password !== confirm ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Las dos contraseñas no coinciden.</p>
            ) : null}
            <PrimaryButton
              label="Siguiente"
              onClick={() => { setError(null); setStep(2); }}
              disabled={!email || password.length < MIN_PASSWORD || password !== confirm}
            />
          </>
        ) : null}

        {step === 1 && method === 'phone' && phoneStep === 'number' ? (
          <>
            <Field label="Número de teléfono" icon="phone" placeholder="+502 1234 5678" value={phone} onChangeText={setPhone} />
            <PrimaryButton
              label="Enviar código"
              onClick={async () => {
                try {
                  setPhoneConfirmation(await requestPhoneCode(phone));
                  setPhoneStep('otp');
                } catch (err) {
                  console.error('[registro] sms', err);
                  const display = describeAuthError(err);
                  if (display?.kind === 'silent') return;
                  toast.error(display?.message ?? 'No pudimos enviar el SMS. Revisa el número e intenta de nuevo.');
                }
              }}
              disabled={phone.length < 8}
            />
          </>
        ) : null}

        {step === 1 && method === 'phone' && phoneStep === 'otp' ? (
          <>
            <div style={{ borderRadius: 16, padding: 16, textAlign: 'center', background: '#E8F8F7', border: '1px solid #C0E8E5' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-body)' }}>Código enviado a</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{phone}</div>
            </div>
            <label className="field-label">Código de 6 dígitos</label>
            <OtpInput value={otp} onChange={setOtp} />
            {import.meta.env.DEV ? (
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center' }}>Modo prueba: sin SMS — el código aparece en el log del servidor</p>
            ) : null}
            <PrimaryButton
              label="Verificar código"
              onClick={async () => {
                try {
                  if (!phoneConfirmation) throw new Error('No confirmation');
                  setFirebaseToken(await confirmPhoneCode(phoneConfirmation, otp));
                  setStep(2);
                } catch (err) {
                  console.error('[registro] otp', err);
                  // Un código caducado no se arregla releyéndolo: hay que pedir otro.
                  const display = describeAuthError(err);
                  if (display?.kind === 'silent') return;
                  toast.error(display?.message ?? 'Código incorrecto. Verifica e intenta de nuevo.');
                }
              }}
              disabled={otp.length < 6 || !phoneConfirmation}
            />
            <button onClick={() => setPhoneStep('number')} className="center muted" style={{ fontSize: 12.5, padding: 8 }}>
              ¿No recibiste el código? <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Reenviar</span>
            </button>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label="Nombre" icon="user" placeholder="María" value={name} onChangeText={setName} />
            <Field label="Apellido" icon="user" placeholder="García" value={lastname} onChangeText={setLastname} />
            <SelectOrAdd label="Institución" icon="map-pin" placeholder="Selecciona tu institución" value={institucion} options={schools} onChange={setInstitucion} newPlaceholder="Nombre de la institución" />
            <LocationAutocomplete label="Ubicación" value={ubicacion} placeholder="Busca tu ubicación" onChange={setUbicacion} />
            <PrimaryButton
              label={submitting ? 'Creando cuenta...' : 'Crear cuenta'}
              onClick={finishRegister}
              disabled={submitting || !name || !lastname || !institucion || !ubicacion}
            />
          </>
        ) : null}
        <div style={{ height: 8 }} />
      </div>

      <div style={{ padding: '24px 0 0', textAlign: 'center' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          ¿Ya tienes cuenta?{' '}
          <button onClick={() => navigate('/login')} style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 12.5 }}>
            Iniciar sesión
          </button>
        </span>
      </div>
      </div>
      <div id="recaptcha-container" />
    </div>
  );
}

function MethodCard({ iconBg, iconColor, icon, google, title, subtitle, onClick }: {
  iconBg: string; iconColor?: string; icon?: IconName; google?: boolean; title: string; subtitle: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="pressable" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, background: '#fff', border: '1.5px solid var(--border-soft)', textAlign: 'left', width: '100%' }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconBg, flexShrink: 0 }}>
        {google ? <GoogleIcon size={22} /> : <Icon name={icon!} size={22} color={iconColor} />}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>{subtitle}</span>
      </span>
      <Icon name="chevron-right" size={16} color="var(--text-muted)" />
    </button>
  );
}

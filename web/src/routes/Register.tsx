import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { INSTITUCIONES } from '@explorarte/shared';
import { GoogleIcon, Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Field, LocationAutocomplete, PrimaryButton, SelectOrAdd } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { OtpInput } from './Login';

type Method = 'google' | 'phone' | 'email' | null;
const TITLES = ['Crear cuenta', 'Verificar identidad', 'Tu información'];

export default function Register() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

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

  // Los registros ya no necesitan aprobación: la cuenta queda activa y entra
  // directo a la app.
  const finishRegister = async () => {
    const result = await api.auth.register({ name, lastname, institucion, ubicacion, email, password, phone });
    signIn(result);
    navigate('/main', { replace: true });
  };

  const back = () => {
    if (step === 0) navigate('/login');
    else if (step === 1) { setStep(0); setMethod(null); }
    else setStep(1);
  };

  const choose = (m: Method) => {
    if (m === 'google') {
      // No real Google OAuth yet — don't fake success / create an empty-credential
      // account. Honest "coming soon", matching the login screen.
      window.alert('Próximamente: el registro con Google estará disponible muy pronto. Por ahora usa tu correo o teléfono.');
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
        <button onClick={back} style={{ width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border-input)' }}>
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
            <PrimaryButton label="Siguiente" onClick={() => setStep(2)} disabled={!email || !password || password !== confirm} />
          </>
        ) : null}

        {step === 1 && method === 'phone' && phoneStep === 'number' ? (
          <>
            <Field label="Número de teléfono" icon="phone" placeholder="+502 1234 5678" value={phone} onChangeText={setPhone} />
            <PrimaryButton label="Enviar código" onClick={() => api.auth.requestOtp(phone).then(() => setPhoneStep('otp'))} disabled={phone.length < 8} />
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
                  await api.auth.checkOtp(phone, otp);
                  setStep(2);
                } catch {
                  window.alert('Código incorrecto. Verifica e intenta de nuevo.');
                }
              }}
              disabled={otp.length < 6}
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
            <SelectOrAdd label="Institución" icon="map-pin" placeholder="Selecciona tu institución" value={institucion} options={INSTITUCIONES} onChange={setInstitucion} newPlaceholder="Nombre de la institución" />
            <LocationAutocomplete label="Ubicación" value={ubicacion} placeholder="Busca tu ubicación" onChange={setUbicacion} />
            <PrimaryButton label="Crear cuenta" onClick={finishRegister} disabled={!name || !lastname || !institucion || !ubicacion} />
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

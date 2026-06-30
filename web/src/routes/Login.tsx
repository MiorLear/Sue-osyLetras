import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthResult } from '@explorarte/shared';
import { GoogleIcon, Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Field, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api, usingMock } from '@/lib/api';

type ViewKind = 'main' | 'phone-number' | 'phone-otp';

// Seeded demo accounts (mock mode only). Any password works; role/status are
// resolved by email — see shared/src/api/mock/seed.ts.
const DEMO_ACCOUNTS = [
  { label: 'Administrador', emoji: '🛠️', email: 'admin@explorarte.org' },
  { label: 'Docente', emoji: '👩‍🏫', email: 'maria@ejemplo.com' },
] as const;

const TITLES: Record<ViewKind, string> = {
  main: 'Bienvenida de nuevo',
  'phone-number': 'Ingresa tu teléfono',
  'phone-otp': 'Verificar número',
};

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [view, setView] = useState<ViewKind>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  // Los registros ya no requieren aprobación. Solo se bloquea a quien una
  // administradora le quitó el acceso ('rejected'); el resto entra: admins a la
  // consola y docentes a la app.
  const enter = (result: AuthResult) => {
    const u = result.user;
    if (u.status === 'rejected') {
      navigate('/pendiente', { replace: true, state: { status: u.status } });
      return;
    }
    signIn(u);
    navigate(u.role === 'admin' ? '/admin' : '/main', { replace: true });
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
              <SocialButton kind="google" label="Continuar con Google" onClick={() => api.auth.login({ email: '', password: '' }).then(enter)} />
              <SocialButton kind="phone" label="Continuar con teléfono" onClick={() => setView('phone-number')} />
              <Divider />
              <Field label="Correo electrónico" icon="mail" placeholder="correo@ejemplo.com" type="email" autoCapitalize="none" value={email} onChangeText={setEmail} />
              <Field label="Contraseña" password placeholder="Tu contraseña" value={password} onChangeText={setPassword} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => navigate('/forgot-password')} style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <PrimaryButton label="Iniciar sesión" onClick={() => api.auth.login({ email, password }).then(enter)} disabled={!email || !password} />

              {usingMock ? (
                <div style={{ marginTop: 4, padding: 14, borderRadius: 14, background: 'var(--nav-bg)', border: '1px solid #DCEDEA' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--brand-dark)', marginBottom: 8 }}>
                    Cuentas de demostración
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
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
            </>
          ) : null}

          {view === 'phone-number' ? (
            <>
              <Field label="Número de teléfono" icon="phone" placeholder="+502 1234 5678" value={phone} onChangeText={setPhone} />
              <PrimaryButton label="Enviar código" onClick={() => api.auth.requestOtp(phone).then(() => setView('phone-otp'))} disabled={phone.length < 8} />
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
              <PrimaryButton label="Verificar e iniciar sesión" onClick={() => api.auth.verifyOtp(phone, otp).then(enter)} disabled={otp.length < 6} />
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

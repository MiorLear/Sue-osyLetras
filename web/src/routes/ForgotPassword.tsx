import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Field, PrimaryButton } from '@/components/ui';
import { api } from '@/lib/api';
import { OtpInput } from './Login';

type Tab = 'email' | 'phone';
type Step = 'input' | 'otp' | 'password' | 'success';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('email');
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goLogin = () => navigate('/login');
  const isPhone = tab === 'phone';
  const canSend = isPhone ? identifier.length >= 8 : identifier.includes('@');

  const switchTab = (t: Tab) => {
    setTab(t);
    setIdentifier('');
    setError(null);
  };

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.requestOtp(identifier);
      setStep('otp');
    } catch {
      setError('No se pudo enviar el código. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.checkOtp(identifier, otp);
      setStep('password');
    } catch {
      setError('Código incorrecto. Verifica e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async () => {
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.auth.resetPassword(identifier, otp, password);
      setStep('success');
    } catch {
      setError('No se pudo restablecer la contraseña. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <button onClick={goLogin} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-body)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          <Icon name="arrow-left" size={18} color="var(--text-body)" /> Volver al inicio de sesión
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <Logo size={48} />
          <h1 style={{ marginTop: 12, fontSize: 19, fontWeight: 800, color: 'var(--text-dark)' }}>Recuperar contraseña</h1>
          <p style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
            Te ayudamos a recuperar el acceso a tu cuenta
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 'input' ? (
            <div style={{ display: 'flex', padding: 4, borderRadius: 16, background: '#E8F8F7' }}>
              <TabBtn label="Por correo" icon="mail" active={!isPhone} onClick={() => switchTab('email')} />
              <TabBtn label="Por teléfono" icon="phone" active={isPhone} onClick={() => switchTab('phone')} />
            </div>
          ) : null}

          {step === 'input' ? (
            <>
              <InfoBox
                text={
                  isPhone
                    ? 'Ingresa tu número de teléfono y te enviaremos un código de 6 dígitos para verificar tu identidad.'
                    : 'Ingresa el correo con el que te registraste y te enviaremos un código de 6 dígitos para restablecer tu contraseña.'
                }
              />
              <Field
                label={isPhone ? 'Número de teléfono' : 'Correo electrónico'}
                icon={isPhone ? 'phone' : 'mail'}
                placeholder={isPhone ? '+502 1234 5678' : 'correo@ejemplo.com'}
                type={isPhone ? 'tel' : 'email'}
                autoCapitalize="none"
                value={identifier}
                onChangeText={setIdentifier}
              />
              {error ? <ErrorText text={error} /> : null}
              <PrimaryButton label={loading ? 'Enviando...' : 'Enviar código'} onClick={sendCode} disabled={!canSend || loading} />
            </>
          ) : null}

          {step === 'otp' ? (
            <>
              <div style={{ borderRadius: 16, padding: 16, textAlign: 'center', background: '#E8F8F7', border: '1px solid #C0E8E5' }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-body)' }}>Código enviado a</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{identifier}</div>
              </div>
              <label className="field-label">Código de 6 dígitos</label>
              <OtpInput value={otp} onChange={setOtp} />
              {import.meta.env.DEV ? (
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center' }}>Modo prueba: el código es 123456</p>
              ) : null}
              {error ? <ErrorText text={error} /> : null}
              <PrimaryButton label={loading ? 'Verificando...' : 'Verificar código'} onClick={verifyCode} disabled={otp.length < 6 || loading} />
              <button onClick={sendCode} className="center muted" style={{ fontSize: 12.5, padding: 8 }}>
                ¿No recibiste el código? <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Reenviar</span>
              </button>
            </>
          ) : null}

          {step === 'password' ? (
            <>
              <InfoBox text="Crea una nueva contraseña para tu cuenta." />
              <Field label="Nueva contraseña" password placeholder="Mínimo 6 caracteres" value={password} onChangeText={setPassword} />
              <Field label="Confirmar contraseña" password placeholder="Repite tu contraseña" value={confirm} onChangeText={setConfirm} />
              {error ? <ErrorText text={error} /> : null}
              <PrimaryButton label={loading ? 'Guardando...' : 'Guardar contraseña'} onClick={submitNewPassword} disabled={!password || !confirm || loading} />
            </>
          ) : null}

          {step === 'success' ? (
            <>
              <SuccessBox emoji="✅" title="¡Contraseña actualizada!" text="Ya puedes iniciar sesión con tu nueva contraseña." />
              <PrimaryButton label="Ir al inicio de sesión" onClick={goLogin} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ErrorText({ text }: { text: string }) {
  return <p style={{ fontSize: 12.5, color: '#E53E3E', textAlign: 'center' }}>{text}</p>;
}

function TabBtn({ label, icon, active, onClick }: { label: string; icon: 'mail' | 'phone'; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: 12, background: active ? '#fff' : 'transparent', boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : undefined, fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? 'var(--text-dark)' : 'var(--text-muted)' }}>
      <Icon name={icon} size={14} color={active ? 'var(--text-dark)' : 'var(--text-muted)'} />
      {label}
    </button>
  );
}

function InfoBox({ text }: { text: string }) {
  return <div style={{ borderRadius: 16, padding: 16, background: '#F0FFFE', border: '1px solid #C0E8E5', fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.5 }}>{text}</div>;
}

function SuccessBox({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div style={{ borderRadius: 16, padding: 24, textAlign: 'center', background: '#F0FFF8', border: '1.5px solid #C6F6D5' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}

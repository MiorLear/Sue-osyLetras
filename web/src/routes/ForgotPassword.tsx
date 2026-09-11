import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Field, PrimaryButton } from '@/components/ui';
import { api } from '@/lib/api';

type Step = 'input' | 'sent' | 'password' | 'success';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const resetLink = new URLSearchParams(window.location.search);
  const linkEmail = resetLink.get('email')?.trim() ?? '';
  const linkCode = resetLink.get('code')?.trim() ?? '';
  const hasResetLink = Boolean(linkEmail && linkCode);
  const [email, setEmail] = useState(linkEmail);
  const [step, setStep] = useState<Step>(hasResetLink ? 'password' : 'input');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goLogin = () => navigate('/login');

  const sendLink = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.forgotPassword(email.trim());
      setStep('sent');
    } catch {
      setError('No se pudo enviar el enlace. Revisa tu conexión e intenta de nuevo.');
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
      await api.auth.resetPassword(linkEmail, linkCode, password);
      setStep('success');
      window.history.replaceState({}, '', '/forgot-password');
    } catch {
      setError('El enlace es inválido o ya venció. Solicita uno nuevo.');
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
            <>
              <InfoBox text="Ingresa el correo con el que te registraste. Te enviaremos un enlace seguro para crear una nueva contraseña." />
              <Field
                label="Correo electrónico"
                icon="mail"
                placeholder="correo@ejemplo.com"
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              {error ? <ErrorText text={error} /> : null}
              <PrimaryButton label={loading ? 'Enviando...' : 'Enviar enlace'} onClick={sendLink} disabled={!email.includes('@') || loading} />
            </>
          ) : null}

          {step === 'sent' ? (
            <>
              <SuccessBox emoji="📨" title="Revisa tu correo" text={`Si existe una cuenta asociada a ${email.trim()}, recibirás un enlace para restablecer tu contraseña. También revisa la carpeta de spam.`} />
              {error ? <ErrorText text={error} /> : null}
              <button onClick={sendLink} disabled={loading} className="center muted tap-44" style={{ fontSize: 12.5, padding: 8 }}>
                ¿No recibiste el correo? <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Reenviar enlace</span>
              </button>
            </>
          ) : null}

          {step === 'password' ? (
            <>
              <InfoBox text="Crea una nueva contraseña para tu cuenta." />
              <Field label="Nueva contraseña" password autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={password} onChangeText={setPassword} />
              <Field label="Confirmar contraseña" password autoComplete="new-password" placeholder="Repite tu contraseña" value={confirm} onChangeText={setConfirm} />
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

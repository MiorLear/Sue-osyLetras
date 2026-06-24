import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Field, PrimaryButton } from '@/components/ui';
import { api } from '@/lib/api';
import { OtpInput } from './Login';

type Tab = 'email' | 'phone';
type PhoneStep = 'number' | 'otp' | 'success';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('email');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('number');

  const goLogin = () => navigate('/login');
  const showTabs = !emailSent && phoneStep !== 'success';

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
        {showTabs ? (
          <div style={{ display: 'flex', padding: 4, borderRadius: 16, background: '#E8F8F7' }}>
            <TabBtn label="Por correo" icon="mail" active={tab === 'email'} onClick={() => setTab('email')} />
            <TabBtn label="Por teléfono" icon="phone" active={tab === 'phone'} onClick={() => setTab('phone')} />
          </div>
        ) : null}

        {tab === 'email' && !emailSent ? (
          <>
            <InfoBox text="Ingresa el correo electrónico con el que te registraste y te enviaremos un enlace para restablecer tu contraseña." />
            <Field label="Correo electrónico" icon="mail" placeholder="correo@ejemplo.com" type="email" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <PrimaryButton label="Enviar enlace de recuperación" onClick={() => api.auth.forgotPassword(email).then(() => setEmailSent(true))} disabled={!email.includes('@')} />
          </>
        ) : null}

        {tab === 'email' && emailSent ? (
          <>
            <SuccessBox emoji="📬" title="¡Correo enviado!" text={`Revisa tu bandeja de entrada en ${email}. Te enviamos un enlace para restablecer tu contraseña.`} />
            <PrimaryButton label="Volver al inicio de sesión" onClick={goLogin} />
          </>
        ) : null}

        {tab === 'phone' && phoneStep === 'number' ? (
          <>
            <InfoBox text="Ingresa tu número de teléfono y te enviaremos un código de 6 dígitos para verificar tu identidad." />
            <Field label="Número de teléfono" icon="phone" placeholder="+502 1234 5678" value={phone} onChangeText={setPhone} />
            <PrimaryButton label="Enviar código" onClick={() => api.auth.requestOtp(phone).then(() => setPhoneStep('otp'))} disabled={phone.length < 8} />
          </>
        ) : null}

        {tab === 'phone' && phoneStep === 'otp' ? (
          <>
            <div style={{ borderRadius: 16, padding: 16, textAlign: 'center', background: '#E8F8F7', border: '1px solid #C0E8E5' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-body)' }}>Código enviado a</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{phone}</div>
            </div>
            <label className="field-label">Código de 6 dígitos</label>
            <OtpInput value={otp} onChange={setOtp} />
            <PrimaryButton label="Verificar código" onClick={() => setPhoneStep('success')} disabled={otp.length < 6} />
            <button onClick={() => setPhoneStep('number')} className="center muted" style={{ fontSize: 12.5, padding: 8 }}>
              ¿No recibiste el código? <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Reenviar</span>
            </button>
          </>
        ) : null}

        {tab === 'phone' && phoneStep === 'success' ? (
          <>
            <SuccessBox emoji="✅" title="¡Identidad verificada!" text="Puedes ingresar una nueva contraseña para tu cuenta." />
            <PrimaryButton label="Volver al inicio de sesión" onClick={goLogin} />
          </>
        ) : null}
      </div>
      </div>
    </div>
  );
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

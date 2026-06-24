import { useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { PrimaryButton } from '@/components/ui';

interface LocationState {
  justRegistered?: boolean;
  status?: 'pending' | 'rejected';
}

export default function PendingApproval() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { justRegistered, status } = (state as LocationState) ?? {};
  const rejected = status === 'rejected';

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <Logo size={56} />
          <span style={{ fontSize: 52, marginTop: 16 }}>{rejected ? '🚫' : '🌱'}</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', marginTop: 12, fontSize: 26, fontWeight: 600, color: 'var(--text-dark)' }}>
            {rejected ? 'Cuenta no aprobada' : justRegistered ? '¡Cuenta creada!' : 'Cuenta pendiente'}
          </h1>
        </div>

        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--text-body)', marginBottom: 8 }}>
          {rejected
            ? 'Tu solicitud no fue aprobada. Si crees que es un error, comunícate con el equipo de Sueños y Letras.'
            : 'Tu cuenta está pendiente de aprobación por una administradora. Te avisaremos cuando puedas ingresar.'}
        </p>

        {!rejected ? (
          <div style={{ margin: '18px 0', padding: 16, borderRadius: 16, background: 'var(--nav-bg)', border: '1px solid #DCEDEA', textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-dark)', marginBottom: 6 }}>¿Qué sigue?</div>
            <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>
              Una administradora revisará tu registro y aprobará tu acceso. Mientras tanto, no es necesario que hagas nada más.
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <PrimaryButton label="Volver al inicio de sesión" onClick={() => navigate('/login', { replace: true })} />
        </div>
      </div>
    </div>
  );
}

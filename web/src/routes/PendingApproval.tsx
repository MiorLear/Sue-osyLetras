import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { PrimaryButton } from '@/components/ui';

// Los registros ya no necesitan aprobación: esta pantalla solo se muestra cuando
// una administradora le quitó el acceso a una cuenta ('rejected').
export default function PendingApproval() {
  const navigate = useNavigate();

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <Logo size={56} />
          <span style={{ fontSize: 52, marginTop: 16 }}>🚫</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', marginTop: 12, fontSize: 26, fontWeight: 600, color: 'var(--text-dark)' }}>
            Tu cuenta no tiene acceso
          </h1>
        </div>

        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--text-body)', marginBottom: 8 }}>
          El acceso a esta cuenta fue retirado. Si crees que es un error, comunícate con el equipo de Sueños y Letras.
        </p>

        <div style={{ marginTop: 16 }}>
          <PrimaryButton label="Volver al inicio de sesión" onClick={() => navigate('/login', { replace: true })} />
        </div>
      </div>
    </div>
  );
}

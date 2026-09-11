import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { toast } from './toast-store';

/** Turns otherwise silent runtime failures into a visible, recoverable alert. */
export function ErrorAlerts() {
  useEffect(() => {
    const onError = () => toast.error('Ocurrió un error inesperado. Recarga la página e intenta de nuevo.', { title: 'Algo salió mal' });
    const onRejection = () => toast.error('No se pudo completar la acción. Intenta de nuevo.', { title: 'Error' });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] render error', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page page-narrow" role="alert" style={{ paddingTop: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 46, marginBottom: 14 }}>🌿</div>
        <h1 style={{ fontSize: 22, color: 'var(--text-dark)', marginBottom: 8 }}>Algo salió mal</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>No pudimos mostrar esta pantalla.</p>
        <button onClick={() => window.location.reload()} style={{ padding: '12px 18px', borderRadius: 12, background: 'var(--brand-dark)', color: '#fff', fontWeight: 700 }}>
          Recargar aplicación
        </button>
      </main>
    );
  }
}

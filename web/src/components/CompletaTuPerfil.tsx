import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { readMetaValue, writeMetaValue } from '@/lib/app-meta';

/** La ranura que recuerda que ya se vio el modal. Por usuaria, como todo en
 *  `meta`: una tablet de aula la comparten varias docentes. */
const VISTO = 'profile.welcome.seen';

/**
 * El aviso de "completa tu perfil" para una cuenta recién invitada.
 *
 * Son dos cosas, y la distinción importa. La primera vez que entra sale un
 * modal, que es lo único que de verdad se lee. A partir de ahí queda una franja
 * discreta, porque un modal que reaparece en cada visita se cierra sin mirarlo.
 *
 * Quien manda es el servidor (`profileCompleted`), no una marca local: la
 * ranura de `meta` se borra al cerrar sesión y no cruza dispositivos, así que
 * por sí sola volvería a enseñar el modal a quien ya completó su perfil. La
 * marca local solo decide modal o franja; si se pierde, lo peor que pasa es que
 * el modal salga una vez más.
 */
export function CompletaTuPerfil() {
  const { authed, user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [visto, setVisto] = useState<boolean | null>(null);

  const pendiente = authed && user?.profileCompleted === false;

  useEffect(() => {
    if (!pendiente) return;
    let cancelled = false;
    void (async () => {
      const seen = await readMetaValue<boolean>(VISTO);
      if (!cancelled) setVisto(seen === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pendiente]);

  if (!pendiente) return null;
  // `null` es "todavía no sabemos": enseñar la franja mientras IndexedDB
  // responde haría parpadear una cosa antes de la otra.
  if (visto === null) return null;

  const irAlPerfil = () => {
    void marcarVisto();
    navigate('/profile');
  };

  const marcarVisto = async () => {
    setVisto(true);
    await writeMetaValue(VISTO, true);
  };

  if (!visto) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="completa-perfil-titulo"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          background: 'rgba(31, 41, 40, 0.45)',
        }}>
        <div
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: 20,
            padding: 24,
            background: '#fff',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#E8F8F7',
              marginBottom: 14,
            }}>
            <Icon name="user" size={26} color="var(--brand-dark)" />
          </span>
          <h2
            id="completa-perfil-titulo"
            style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 8 }}>
            Bienvenida a ExplorArte
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.5, marginBottom: 20 }}>
            Tu cuenta ya está lista. Antes de empezar, completa tu perfil con tu nombre, tu ubicación
            y una foto: así te reconocen las demás docentes en la comunidad.
          </p>
          <button
            onClick={irAlPerfil}
            className="pressable"
            style={{
              width: '100%',
              padding: 13,
              borderRadius: 12,
              background: 'var(--brand-dark)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 8,
            }}>
            Completar mi perfil
          </button>
          <button
            onClick={() => void marcarVisto()}
            className="tap-44"
            style={{ width: '100%', padding: 10, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            Más tarde
          </button>
        </div>
      </div>
    );
  }

  // Ya está en el perfil: recordárselo ahí sería ruido sobre el propio
  // formulario que tiene delante.
  if (pathname === '/profile') return null;

  return (
    <button
      onClick={irAlPerfil}
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(var(--bottom-nav-height, 64px) + 12px)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 14px',
        borderRadius: 14,
        background: '#FBF1DA',
        border: '1px solid #F0DEC8',
        textAlign: 'left',
      }}>
      <Icon name="user" size={16} color="#8A6A12" />
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#6E5410' }}>
        Te falta completar tu perfil.
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-dark)' }}>Completar</span>
    </button>
  );
}

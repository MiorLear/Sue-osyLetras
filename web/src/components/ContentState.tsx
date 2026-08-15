import { formatCacheAge, type OfflineStatus } from '@/lib/useOfflineAsync';

// El bloque de "cargando / sin conexión / error / vacío" que va donde debería
// ir el contenido de una pantalla.
//
// Existe porque cada pantalla traía su propia versión escrita a mano, y todas
// decían lo mismo con palabras distintas: "No pudimos cargar los contenidos.
// Revisa tu conexión" aparecía igual cuando la red se había caído que cuando la
// API devolvía un 500. Ahora el estado viene tipado desde useOfflineAsync y
// cada caso dice lo suyo — sobre todo `offline-empty`, que no es un fallo: es
// que esta pantalla todavía no se ha visitado con conexión, y eso se arregla
// visitándola con red, no reintentando (PWA-2.6).
//
// Devuelve null cuando hay contenido que mostrar, para que la pantalla siga
// haciendo `{state ?? <miContenido />}` sin ramas extra.

const WRAP: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  padding: '44px 16px',
  textAlign: 'center',
};

const TEXT: React.CSSProperties = {
  margin: 0,
  fontSize: 14.5,
  lineHeight: 1.6,
  color: 'var(--text-body)',
  maxWidth: 380,
};

const HINT: React.CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  color: 'var(--text-muted)',
};

export interface ContentStateProps {
  status: OfflineStatus;
  /** Vuelve a intentar la carga. Se oculta el botón si no se pasa. */
  onRetry?: () => void;
  /** Qué falta, en plural y en minúsculas: "las emociones", "los eventos". */
  what?: string;
  /** Texto del estado vacío cuando la API respondió pero no había nada. */
  emptyLabel?: string;
  /**
   * La respuesta llegó bien pero venía sin elementos. El hook no lo puede
   * saber — para él una lista vacía es un dato válido — así que lo dice la
   * pantalla, que sí sabe qué está contando.
   */
  isEmpty?: boolean;
}

export function ContentState({
  status,
  onRetry,
  what = 'el contenido',
  emptyLabel,
  isEmpty = false,
}: ContentStateProps) {
  if (status === 'fresh' || status === 'stale') {
    if (!isEmpty) return null;
    return (
      <div style={WRAP}>
        <p style={TEXT}>{emptyLabel ?? `Aún no hay ${what} disponible.`}</p>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div style={WRAP} role="status" aria-live="polite">
        <p style={TEXT}>Cargando…</p>
      </div>
    );
  }

  if (status === 'offline-empty') {
    return (
      <div style={WRAP} role="status">
        <span aria-hidden="true" style={{ fontSize: 34 }}>
          📡
        </span>
        <p style={TEXT}>Sin conexión, y esta pantalla todavía no está guardada en este dispositivo.</p>
        <p style={HINT}>
          Abre esta pantalla una vez con internet y quedará disponible sin conexión.
        </p>
      </div>
    );
  }

  // Sesión caída: la capa de auth ya está sacando a la usuaria de la app, así
  // que aquí solo hace falta no dejar la pantalla en blanco mientras ocurre.
  if (status === 'session-expired') {
    return (
      <div style={WRAP} role="status">
        <p style={TEXT}>Tu sesión terminó. Vuelve a iniciar sesión para continuar.</p>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div style={WRAP}>
        <p style={TEXT}>{emptyLabel ?? `Aún no hay ${what} disponible.`}</p>
      </div>
    );
  }

  return (
    <div style={WRAP} role="alert">
      <p style={TEXT}>No pudimos cargar {what}. Vuelve a intentarlo en un momento.</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            minHeight: 44,
            padding: '10px 20px',
            borderRadius: 11,
            background: 'var(--brand)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13.5,
          }}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

/**
 * Nota discreta con la antigüedad del dato, para las pantallas que muestran
 * caché vieja. Sin ella, contenido de hace una semana se lee como actual
 * (BUG-09). No dice nada mientras el dato esté fresco.
 */
export function CacheAgeNote({ status, ageMs }: { status: OfflineStatus; ageMs?: number }) {
  if (status !== 'stale') return null;
  const age = formatCacheAge(ageMs);
  if (!age) return null;

  return (
    <p
      style={{
        margin: '0 0 14px',
        fontSize: 12,
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
      <span aria-hidden="true">🕓</span>
      Guardado {age}. Se actualizará cuando haya conexión.
    </p>
  );
}

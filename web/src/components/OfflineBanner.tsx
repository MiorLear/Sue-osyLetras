import { useSync } from '@/lib/sync-status';

// Thin status strip pinned to the very top of the viewport. It shows only when
// it has something to say — "Sincronizando…" while a sync runs, or an offline
// notice — and renders nothing at all when online and idle, so it never steals
// space from the screens below.
//
// Web port of src/components/sync-banner.tsx. Two things differ from RN:
//   - `position: fixed` + `env(safe-area-inset-top)` replaces useSafeAreaInsets,
//     so on an installed PWA it clears the notch instead of sitting under it.
//   - It is pinned to the TOP, never the bottom, so it cannot cover the tab bar
//     on the mobile layout.
//
// Inline styles on purpose: global.css belongs to the shell work, and a banner
// that has to survive alongside it shouldn't add class names to that file.

/** Exported so the placement contract can be asserted: jsdom drops `env()`
 *  from inline styles, so reading it back off the DOM proves nothing.
 *  Not worth a separate module — it is one constant, used by one component. */
// eslint-disable-next-line react-refresh/only-export-components
export const BANNER_BAR_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  // Above the app chrome, below modals.
  zIndex: 100,
  // Never intercept a tap meant for whatever is underneath.
  pointerEvents: 'none',
  paddingTop: 'env(safe-area-inset-top, 0px)',
};

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '5px 12px',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.1,
};

function pendingLabel(pending: number): string {
  return pending === 1
    ? 'Sin conexión — 1 cambio se sincronizará al reconectar'
    : `Sin conexión — ${pending} cambios se sincronizarán al reconectar`;
}

export function OfflineBanner() {
  const { online, syncing, pending } = useSync();

  // Online and idle: say nothing.
  if (online && !syncing) return null;

  const offline = !online;
  const label = offline
    ? pending > 0
      ? pendingLabel(pending)
      : 'Sin conexión — mostrando contenido guardado'
    : 'Sincronizando…';

  return (
    <div
      style={{ ...BANNER_BAR_STYLE, background: offline ? '#FBEAE6' : 'var(--nav-bg, #e7f4f2)' }}
      role="status"
      aria-live="polite">
      <div style={{ ...ROW, color: offline ? 'var(--danger, #d8654a)' : 'var(--brand-dark, #1e7e78)' }}>
        {offline ? null : <SyncSpinner />}
        <span>{label}</span>
      </div>
    </div>
  );
}

function SyncSpinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

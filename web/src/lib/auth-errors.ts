/**
 * Turns a Firebase Auth failure into something a teacher can act on.
 *
 * Login used to funnel every non-`ApiError` into "no pudimos conectar con el
 * servidor", which is false for the common cases — an embedded browser that
 * blocks `window.open`, or a popup the user closed — and left field reports
 * undiagnosable. The provider's `code` is the only signal that separates them,
 * so unknown codes are surfaced verbatim instead of being flattened.
 *
 * Kept free of `firebase/*` imports so it unit tests without loading the SDK,
 * and matched by shape rather than `instanceof FirebaseError`: the SDK can be
 * duplicated across chunks, and an identity check would silently stop matching.
 */

/** The `auth/*` code when `err` looks like a Firebase Auth error, else null. */
export function firebaseAuthCode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('auth/') ? code : null;
}

export type AuthErrorDisplay =
  /** The user cancelled on purpose: showing an error would be noise. */
  | { kind: 'silent' }
  | { kind: 'message'; message: string };

/** Cancellations, not failures. `cancelled-popup-request` fires on double-click. */
const CANCELLED = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

const MESSAGES: Record<string, string> = {
  'auth/popup-blocked':
    'Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes para explorarte.app, o abre la app en Chrome o Safari, e intenta de nuevo.',
  'auth/network-request-failed':
    'No pudimos conectar con Google. Revisa tu conexión e intenta de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  'auth/account-exists-with-different-credential':
    'Ya existe una cuenta con ese correo. Inicia sesión con el método que usaste la primera vez.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Escríbenos para reactivarla.',
};

/**
 * How to present `err`, or null when it is not a Firebase Auth error — the
 * caller then falls back to its own mapping (`ApiError` status codes).
 */
export function describeAuthError(err: unknown): AuthErrorDisplay | null {
  const code = firebaseAuthCode(err);
  if (!code) return null;
  if (CANCELLED.has(code)) return { kind: 'silent' };
  const known = MESSAGES[code];
  if (known) return { kind: 'message', message: known };
  // The code travels in the message on purpose: it is what makes a report from
  // a teacher's phone diagnosable without reproducing her browser.
  return {
    kind: 'message',
    message: `No se pudo iniciar sesión con Google (${code}). Intenta de nuevo.`,
  };
}

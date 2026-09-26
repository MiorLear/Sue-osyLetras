import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithPopup = vi.fn();
const signInWithRedirect = vi.fn();
const getRedirectResult = vi.fn();

vi.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: () => ({ name: 'test' }),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ languageCode: 'es' }),
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirect(...args),
  getRedirectResult: (...args: unknown[]) => getRedirectResult(...args),
}));

const { startGoogleSignIn, finishGoogleSignIn } = await import('@/lib/firebase-auth');

beforeEach(() => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
  signInWithPopup.mockReset();
  signInWithRedirect.mockReset();
  getRedirectResult.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  document.body.innerHTML = '';
});

/**
 * El acceso con Google en un navegador embebido.
 *
 * Una docente que abre el enlace desde WhatsApp no está en Chrome ni en Safari:
 * está en el WebView de esa aplicación, donde `window.open` se bloquea. Antes
 * el único plan era pedirle que permitiera las ventanas emergentes, una opción
 * que en un WebView normalmente ni existe.
 */
describe('firebase-auth · entrar con Google', () => {
  const usuario = { getIdToken: async () => 'token-de-google' };

  it('con el popup abierto devuelve el token y no redirige', async () => {
    signInWithPopup.mockResolvedValue({ user: usuario });

    await expect(startGoogleSignIn()).resolves.toEqual({
      kind: 'token',
      idToken: 'token-de-google',
    });
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it.each(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'])(
    'cae a la redirección cuando el popup no es viable (%s)',
    async (code) => {
      signInWithPopup.mockRejectedValue(Object.assign(new Error('nope'), { code }));
      signInWithRedirect.mockResolvedValue(undefined);

      await expect(startGoogleSignIn()).resolves.toEqual({ kind: 'redirecting' });
      expect(signInWithRedirect).toHaveBeenCalledTimes(1);
    },
  );

  // Redirigir aquí sería secuestrar una decisión que ya tomó: cerró la ventana.
  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])(
    'una cancelación se propaga y no manda a nadie a Google (%s)',
    async (code) => {
      signInWithPopup.mockRejectedValue(Object.assign(new Error('cancelado'), { code }));

      await expect(startGoogleSignIn()).rejects.toMatchObject({ code });
      expect(signInWithRedirect).not.toHaveBeenCalled();
    },
  );

  it('un fallo que no es del popup tampoco redirige', async () => {
    signInWithPopup.mockRejectedValue(Object.assign(new Error('red'), { code: 'auth/network-request-failed' }));

    await expect(startGoogleSignIn()).rejects.toMatchObject({ code: 'auth/network-request-failed' });
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it('al volver de la redirección entrega el token', async () => {
    getRedirectResult.mockResolvedValue({ user: usuario });
    await expect(finishGoogleSignIn()).resolves.toBe('token-de-google');
  });

  // Es lo que pasa en cada carga normal de las pantallas de autenticación.
  it('sin redirección pendiente devuelve null', async () => {
    getRedirectResult.mockResolvedValue(null);
    await expect(finishGoogleSignIn()).resolves.toBeNull();
  });
});

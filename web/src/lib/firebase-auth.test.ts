import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El SDK real carga grecaptcha desde la red; lo que se prueba aquí es el ciclo
// de vida que envuelve al verifier, no Firebase.
const instances: Array<{ container: unknown; cleared: boolean }> = [];
const signInWithPhoneNumber = vi.fn();
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
  signInWithPhoneNumber: (...args: unknown[]) => signInWithPhoneNumber(...args),
  RecaptchaVerifier: class {
    container: unknown;
    cleared = false;
    constructor(_auth: unknown, container: unknown) {
      this.container = container;
      instances.push(this);
    }
    clear() {
      if (this.cleared) throw new Error('ya destruido');
      this.cleared = true;
      // El SDK real NO vacía el contenedor cuando el captcha es invisible.
    }
  },
}));

const { requestPhoneCode, confirmPhoneCode, startGoogleSignIn, finishGoogleSignIn } =
  await import('@/lib/firebase-auth');

let host: HTMLElement;

beforeEach(() => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
  instances.length = 0;
  signInWithPhoneNumber.mockReset();
  signInWithPopup.mockReset();
  signInWithRedirect.mockReset();
  getRedirectResult.mockReset();
  host = document.createElement('div');
  host.id = 'recaptcha-container';
  document.body.append(host);
});

afterEach(() => {
  vi.unstubAllEnvs();
  document.body.innerHTML = '';
});

describe('firebase-auth · reCAPTCHA del SMS', () => {
  // grecaptcha se niega a renderizar dos veces en el mismo elemento
  // ("reCAPTCHA has already been rendered in this element"), así que reusar el
  // contenedor dejaba el envío de SMS roto hasta recargar la página.
  it('usa un elemento nuevo en cada intento', async () => {
    signInWithPhoneNumber.mockRejectedValue({ code: 'auth/invalid-phone-number' });

    await expect(requestPhoneCode('+502 1234 5678')).rejects.toBeTruthy();
    await expect(requestPhoneCode('+502 8765 4321')).rejects.toBeTruthy();

    expect(instances).toHaveLength(2);
    expect(instances[0].container).not.toBe(instances[1].container);
  });

  it('no deja basura en el contenedor tras un intento fallido', async () => {
    signInWithPhoneNumber.mockRejectedValue({ code: 'auth/operation-not-allowed' });

    await expect(requestPhoneCode('+50612345678')).rejects.toBeTruthy();

    expect(host.childElementCount).toBe(0);
  });

  it('limpia el verifier cuando el código se confirma', async () => {
    signInWithPhoneNumber.mockResolvedValue({ verificationId: 'abc' });
    await requestPhoneCode('+50212345678');
    expect(host.childElementCount).toBe(1);

    const confirmation = {
      confirm: () => Promise.resolve({ user: { getIdToken: () => Promise.resolve('token') } }),
    };
    await expect(confirmPhoneCode(confirmation as never, '123456')).resolves.toBe('token');

    expect(host.childElementCount).toBe(0);
    expect(instances[0].cleared).toBe(true);
  });

  // Los separadores son como la gente escribe un teléfono. El código de país no
  // se adivina: Guatemala y El Salvador usan 8 dígitos, y mandar el SMS al país
  // equivocado es peor que pedirle a la docente que escriba el +502.
  it('quita los separadores sin inventarse el código de país', async () => {
    signInWithPhoneNumber.mockResolvedValue({ verificationId: 'abc' });

    await requestPhoneCode(' +502 1234-5678 ');

    expect(signInWithPhoneNumber).toHaveBeenCalledWith(
      expect.anything(),
      '+50212345678',
      expect.anything(),
    );
  });

  it('falla con un mensaje claro si la pantalla no montó el contenedor', async () => {
    host.remove();
    await expect(requestPhoneCode('+50212345678')).rejects.toThrow(/contenedor/i);
  });
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

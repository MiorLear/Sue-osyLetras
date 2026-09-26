import { getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';

let authInstance: Auth | null = null;

function firebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('Firebase Authentication no está configurado');
  const app = getApps()[0] ?? initializeApp({
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  });
  authInstance = getAuth(app);
  authInstance.languageCode = 'es';
  return authInstance;
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * Cómo terminó el intento de entrar con Google.
 *
 * `redirecting` no es un caso raro que haya que contemplar por si acaso: es lo
 * que pasa siempre en un navegador embebido. La pestaña se va a Google y esta
 * página deja de existir, así que quien llame no tiene que enseñar nada — solo
 * dejar de esperar un token que no va a llegar por aquí.
 */
export type GoogleSignIn =
  | { kind: 'token'; idToken: string }
  | { kind: 'redirecting' };

/**
 * Los códigos que significan "aquí no se puede abrir una ventana", no "la
 * persona cerró la ventana".
 *
 * La diferencia importa: ante una cancelación, mandar a la pestaña a Google
 * sería secuestrar una decisión que ya tomó. `auth/popup-closed-by-user` y
 * `auth/cancelled-popup-request` se quedan fuera por eso.
 */
const POPUP_NO_VIABLE = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
]);

function codigo(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/**
 * Entra con Google: ventana emergente, y si no se puede, redirección.
 *
 * El popup primero porque conserva el contexto de la página — no hay recarga ni
 * estado que reconstruir. Pero una docente que abre el enlace desde WhatsApp no
 * está en Chrome ni en Safari, está en el navegador embebido de esa aplicación,
 * y ahí `window.open` se bloquea. Decirle "permite las ventanas emergentes" no
 * servía: en un WebView no suele existir esa opción.
 *
 * No se detecta el navegador para decidir. Mirar el user agent es adivinar, y
 * se equivoca en los dos sentidos cada vez que alguien saca una versión nueva;
 * que el popup falle es el hecho mismo que nos importa.
 */
export async function startGoogleSignIn(): Promise<GoogleSignIn> {
  const auth = firebaseAuth();
  try {
    const result = await signInWithPopup(auth, googleProvider());
    return { kind: 'token', idToken: await result.user.getIdToken() };
  } catch (err) {
    if (!POPUP_NO_VIABLE.has(codigo(err) ?? '')) throw err;
    // Navega fuera: nada de lo que venga después de esta línea se ejecuta.
    await signInWithRedirect(auth, googleProvider());
    return { kind: 'redirecting' };
  }
}

/**
 * El token de una redirección que acaba de volver, o null si no había ninguna.
 *
 * Se llama en cada carga de las dos pantallas de autenticación. Es barato
 * cuando no hay nada pendiente, y es la única forma de recoger el resultado:
 * la página que lanzó la redirección ya no existe.
 *
 * Puede lanzar — `auth/account-exists-with-different-credential` es el caso
 * real— así que quien llame tiene que capturarlo igual que captura el popup.
 */
export async function finishGoogleSignIn(): Promise<string | null> {
  const result = await getRedirectResult(firebaseAuth());
  return result ? result.user.getIdToken() : null;
}

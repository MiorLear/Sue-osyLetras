import { getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  getAuth,
  signInWithPhoneNumber,
  signInWithPopup,
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

/** Completes Google sign-in and returns its token directly to the current page. */
export async function startGoogleSignIn(): Promise<string> {
  const result = await signInWithPopup(firebaseAuth(), googleProvider());
  return result.user.getIdToken();
}

/** The always-mounted host both auth screens render. */
const RECAPTCHA_HOST_ID = 'recaptcha-container';

let verifier: RecaptchaVerifier | null = null;
let mount: HTMLElement | null = null;

/**
 * Drops the verifier AND the node grecaptcha rendered into.
 *
 * `RecaptchaVerifier.clear()` only empties the container for *visible* widgets;
 * for the invisible one it leaves the badge behind. Rendering into that same
 * element again throws "reCAPTCHA has already been rendered in this element",
 * so every retry after a first failure — a mistyped number, a country without
 * SMS enabled — died until the page was reloaded. Giving grecaptcha a fresh
 * node each time sidesteps its per-element bookkeeping entirely.
 */
function disposeVerifier(): void {
  try {
    verifier?.clear();
  } catch {
    // clear() throws if the verifier was already destroyed. Nothing to undo.
  }
  verifier = null;
  mount?.remove();
  mount = null;
}

function freshVerifier(auth: Auth): RecaptchaVerifier {
  disposeVerifier();
  const host = document.getElementById(RECAPTCHA_HOST_ID);
  if (!host) throw new Error('Falta el contenedor del reCAPTCHA en la pantalla');
  mount = document.createElement('div');
  host.append(mount);
  return new RecaptchaVerifier(auth, mount, { size: 'invisible' });
}

/**
 * Separators are how people write phone numbers; the country code is not
 * guessed, because Guatemala and El Salvador both use 8 digits and sending a
 * teacher's code to the wrong country is worse than asking her to type `+502`.
 */
function stripSeparators(phone: string): string {
  return phone.replace(/[\s()\-.]/g, '');
}

export async function requestPhoneCode(phone: string): Promise<ConfirmationResult> {
  const auth = firebaseAuth();
  verifier = freshVerifier(auth);
  try {
    return await signInWithPhoneNumber(auth, stripSeparators(phone), verifier);
  } catch (error) {
    disposeVerifier();
    throw error;
  }
}

export async function confirmPhoneCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<string> {
  const credential = await confirmation.confirm(code);
  disposeVerifier();
  return credential.user.getIdToken();
}

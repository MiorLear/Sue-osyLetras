import { getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  getAuth,
  getRedirectResult,
  signInWithPhoneNumber,
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

/** Starts a full-page flow so PWA/in-app browsers do not strand a popup tab. */
export async function startGoogleSignIn(): Promise<void> {
  const auth = firebaseAuth();
  await signInWithRedirect(auth, googleProvider());
}

/** Returns the Google ID token after Firebase redirects back, or null otherwise. */
export async function googleRedirectIdToken(): Promise<string | null> {
  const result = await getRedirectResult(firebaseAuth());
  if (!result) return null;
  return result.user.getIdToken();
}

let verifier: RecaptchaVerifier | null = null;

export async function requestPhoneCode(phone: string): Promise<ConfirmationResult> {
  const auth = firebaseAuth();
  verifier?.clear();
  verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  try {
    return await signInWithPhoneNumber(auth, phone.trim(), verifier);
  } catch (error) {
    verifier.clear();
    verifier = null;
    throw error;
  }
}

export async function confirmPhoneCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<string> {
  const credential = await confirmation.confirm(code);
  verifier?.clear();
  verifier = null;
  return credential.user.getIdToken();
}

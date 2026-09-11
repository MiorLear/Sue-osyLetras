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

export async function googleIdToken(): Promise<string> {
  const auth = firebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
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

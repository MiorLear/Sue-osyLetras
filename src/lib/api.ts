import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { createConfigurableApiClient, type ApiModuleKey } from '@explorarte/shared';

// Mirrors web/src/lib/api.ts, adapted for React Native:
//   - env vars use Expo's EXPO_PUBLIC_ convention (inlined by Metro) instead
//     of Vite's import.meta.env.
//   - the token lives in expo-secure-store (no localStorage in RN) but is
//     mirrored into an in-memory variable so ApiClient's synchronous
//     getToken() can read it without an await on every request.
//
// IMPORTANT for physical devices: Expo Go can't reach "localhost" on your
// dev machine — EXPO_PUBLIC_API_URL must be your machine's LAN IP, e.g.
// http://192.168.1.23:8000 (same constraint as scanning the QR code).

const TOKEN_KEY = 'explorarte_token';
let cachedToken: string | null = null;

// Hydrate the stored token on module load and expose a promise so the app entry
// can wait for it before choosing onboarding-vs-app. SecureStore is local, so
// this resolves even with no connection — enabling a "stay logged in" cold start
// that opens straight into cached content offline.
export const authReady: Promise<void> = SecureStore.getItemAsync(TOKEN_KEY)
  .then((token) => {
    cachedToken = token;
  })
  .catch(() => {});

/** True once a token is loaded/set — routes a returning user into the app (works offline). */
export function hasToken(): boolean {
  return cachedToken != null;
}

export async function setAuthToken(token: string | null) {
  cachedToken = token;
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

const baseUrl = process.env.EXPO_PUBLIC_API_URL;
const mockModules = (process.env.EXPO_PUBLIC_API_MOCK_MODULES ?? '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean) as ApiModuleKey[];

let sessionExpiredRedirecting = false;

export const api = createConfigurableApiClient({
  baseUrl,
  mockModules,
  getToken: () => cachedToken,
  // On any 401 the session is gone/expired — clear it and bounce to login so
  // screens don't sit blank on an unhandled auth error.
  onUnauthorized: () => {
    setAuthToken(null).catch(() => {});
    if (!sessionExpiredRedirecting) {
      sessionExpiredRedirecting = true;
      router.replace('/login');
      setTimeout(() => {
        sessionExpiredRedirecting = false;
      }, 1500);
    }
  },
});

export const usingMock = !baseUrl;

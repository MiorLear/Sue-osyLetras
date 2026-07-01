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

// Best-effort hydration on module load — covers Fast Refresh / JS context
// reloads. This app doesn't yet have a persisted "stay logged in" flow across
// full app restarts (there's no splash-gated hydration), so a cold start
// still requires signing in again, same as today.
SecureStore.getItemAsync(TOKEN_KEY)
  .then((token) => {
    cachedToken = token;
  })
  .catch(() => {});

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

export const api = createConfigurableApiClient({
  baseUrl,
  mockModules,
  getToken: () => cachedToken,
});

export const usingMock = !baseUrl;

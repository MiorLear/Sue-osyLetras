import { createConfigurableApiClient, type ApiModuleKey } from '@explorarte/shared';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';

// Production uses the real backend. Development mock data is available only
// with the explicit VITE_API_MOCK=true opt-in; a missing URL must never turn a
// password check into the passwordless demo client.
//
// VITE_API_MOCK_MODULES lets you keep specific modules on the mock even while
// VITE_API_URL is set (e.g. "posts,tools" while the rest of the API is real) —
// handy for working in parallel with a backend that isn't fully done yet.
const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
const mockOptIn = !baseUrl && import.meta.env.VITE_API_MOCK === 'true';
if (!baseUrl && !mockOptIn) {
  throw new Error('API configuration missing: set VITE_API_URL or explicitly set VITE_API_MOCK=true');
}
const mockModules = ((import.meta.env.VITE_API_MOCK_MODULES as string | undefined) ?? '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean) as ApiModuleKey[];

export const api = createConfigurableApiClient({
  baseUrl,
  defaultMode: mockOptIn ? 'mock' : 'http',
  mockModules,
  getToken: getAuthToken,
  // On any 401 the session is gone/expired — clear it and bounce to login so
  // screens don't sit blank on an unhandled auth error.
  onUnauthorized: () => {
    void clearAuthToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  },
});

export const usingMock = mockOptIn;

import { createConfigurableApiClient, type ApiModuleKey } from '@explorarte/shared';

// Default: the in-memory mock. Set VITE_API_URL in a .env file to point the
// app at the real REST backend — no screen code changes required.
//
// VITE_API_MOCK_MODULES lets you keep specific modules on the mock even while
// VITE_API_URL is set (e.g. "posts,tools" while the rest of the API is real) —
// handy for working in parallel with a backend that isn't fully done yet.
const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
const mockModules = ((import.meta.env.VITE_API_MOCK_MODULES as string | undefined) ?? '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean) as ApiModuleKey[];

export const api = createConfigurableApiClient({
  baseUrl,
  mockModules,
  getToken: () => localStorage.getItem('explorarte_token'),
  // On any 401 the session is gone/expired — clear it and bounce to login so
  // screens don't sit blank on an unhandled auth error.
  onUnauthorized: () => {
    localStorage.removeItem('explorarte_token');
    localStorage.removeItem('explorarte_user');
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  },
});

export const usingMock = !baseUrl;

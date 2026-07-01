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
});

export const usingMock = !baseUrl;

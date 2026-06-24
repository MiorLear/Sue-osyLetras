import { createApiClient } from '@explorarte/shared';

// Default: the in-memory mock. Set VITE_API_URL in a .env file to point the same
// screens at the real REST backend — no screen code changes required.
const baseUrl = import.meta.env.VITE_API_URL as string | undefined;

export const api = createApiClient(
  baseUrl
    ? { mode: 'http', baseUrl, getToken: () => localStorage.getItem('explorarte_token') }
    : { mode: 'mock' },
);

export const usingMock = !baseUrl;

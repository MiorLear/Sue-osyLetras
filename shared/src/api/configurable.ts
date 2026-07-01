// Configurable adapter — mixes the mock and http adapters on a per-module
// basis, so each app (web/mobile) can decide, module by module, whether it
// talks to the in-memory mock or the real REST backend. This is a dev-time
// convenience (config only, not a runtime/user-facing switch): it lets a team
// keep working against the mock for modules the backend hasn't implemented
// yet, while already using the real API for the modules that are ready.

import type { ApiClient } from './client.js';
import { createMockClient } from './mock/index.js';
import { createHttpClient } from './http/index.js';

export type ApiModuleKey =
  | 'auth'
  | 'emotions'
  | 'posts'
  | 'events'
  | 'learning'
  | 'tools'
  | 'profile'
  | 'misc'
  | 'admin';

export interface CreateConfigurableApiClientOptions {
  /** required if any module resolves to 'http' */
  baseUrl?: string;
  getToken?: () => string | null | undefined;
  /** default mode for modules not listed in mockModules; defaults to 'http' when baseUrl is set, else 'mock' */
  defaultMode?: 'mock' | 'http';
  /** module keys that should always use the mock adapter, overriding defaultMode */
  mockModules?: ApiModuleKey[];
}

export function createConfigurableApiClient(
  opts: CreateConfigurableApiClientOptions = {},
): ApiClient {
  const mock = createMockClient();
  const http = opts.baseUrl
    ? createHttpClient({ baseUrl: opts.baseUrl, getToken: opts.getToken })
    : undefined;
  const defaultMode = opts.defaultMode ?? (opts.baseUrl ? 'http' : 'mock');
  const forcedMock = new Set(opts.mockModules ?? []);

  const pick = <K extends ApiModuleKey>(key: K): ApiClient[K] => {
    const useHttp = !forcedMock.has(key) && defaultMode === 'http';
    if (useHttp) {
      if (!http) throw new Error(`createConfigurableApiClient: module '${key}' resolved to 'http' but no baseUrl was given`);
      return http[key];
    }
    return mock[key];
  };

  return {
    auth: pick('auth'),
    emotions: pick('emotions'),
    posts: pick('posts'),
    events: pick('events'),
    learning: pick('learning'),
    tools: pick('tools'),
    profile: pick('profile'),
    misc: pick('misc'),
    admin: pick('admin'),
  };
}

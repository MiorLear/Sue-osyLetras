// Factory that picks the adapter. This is the one line an app changes to move
// from local mock data to the real REST backend.

import type { ApiClient } from './client.js';
import { createMockClient } from './mock/index.js';
import { createHttpClient } from './http/index.js';

export type ApiMode = 'mock' | 'http';

export interface CreateApiClientOptions {
  mode?: ApiMode;
  /** required when mode === 'http' */
  baseUrl?: string;
  getToken?: () => string | null | undefined;
}

export function createApiClient(opts: CreateApiClientOptions = {}): ApiClient {
  const mode = opts.mode ?? 'mock';
  if (mode === 'http') {
    if (!opts.baseUrl) throw new Error("createApiClient: baseUrl is required when mode is 'http'");
    return createHttpClient({ baseUrl: opts.baseUrl, getToken: opts.getToken });
  }
  return createMockClient();
}

export { createMockClient } from './mock/index.js';
export { createHttpClient } from './http/index.js';
export type { ApiClient } from './client.js';
export type {
  AuthApi,
  EmotionsApi,
  PostsApi,
  EventsApi,
  LearningApi,
  ToolsApi,
  ProfileApi,
  MiscApi,
  AdminApi,
  AdminUsersApi,
} from './client.js';

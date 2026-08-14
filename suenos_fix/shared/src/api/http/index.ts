// HTTP adapter — implements ApiClient against a real REST backend (the future
// Python/FastAPI or Java/Spring Boot service described in openapi.yaml).
//
// Already complete: flip the app from mock to http by passing
// createApiClient({ mode: 'http', baseUrl }) — no screen code changes needed.

import type { ApiClient, MediaCategory } from '../client.js';
import type {
  AuthResult,
  CalEvent,
  Comment,
  CreateCommentInput,
  CreateEventInput,
  CreatePostInput,
  CreateTopicInput,
  Emotion,
  EmotionDetail,
  LoginInput,
  MediaItem,
  Post,
  RegisterInput,
  ScreenIntroVideo,
  Topic,
  ToolsContent,
  UpdateEventInput,
  UpdateProfileInput,
  UpdateTopicInput,
  UserProfile,
  UserStatus,
} from '../../types/index.js';

/** Error thrown by the HTTP adapter, carrying the HTTP status so callers can
 * branch on it (e.g. 401 -> session expired, 404 -> not found). */
export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, message: string, body = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface HttpClientOptions {
  baseUrl: string;
  /** optional bearer token supplier for authenticated requests */
  getToken?: () => string | null | undefined;
  /** called once whenever a request comes back 401, so the app can clear the
   * session and redirect to login instead of leaving screens blank. */
  onUnauthorized?: () => void;
}

export function createHttpClient(opts: HttpClientOptions): ApiClient {
  const base = opts.baseUrl.replace(/\/$/, '');

  function fail(method: string, path: string, status: number, detail: string): never {
    if (status === 401) opts.onUnauthorized?.();
    throw new ApiError(status, `${method} ${path} failed: ${status} ${detail}`, detail);
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = opts.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) fail(method, path, res.status, await res.text().catch(() => ''));
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // Separate from request(): multipart bodies must NOT be JSON-stringified and
  // must leave Content-Type unset so fetch/RN set the correct boundary itself.
  async function uploadFile(path: string, file: Blob, filename: string): Promise<MediaItem> {
    const headers: Record<string, string> = {};
    const token = opts.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const form = new FormData();
    form.append('file', file, filename);

    const res = await fetch(base + path, { method: 'POST', headers, body: form });
    if (!res.ok) fail('POST', path, res.status, await res.text().catch(() => ''));
    return (await res.json()) as MediaItem;
  }

  async function getOrNull<T>(path: string): Promise<T | null> {
    try {
      return await request<T>('GET', path);
    } catch {
      return null;
    }
  }

  const q = (params: Record<string, string | undefined>) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null) usp.set(k, v);
    const s = usp.toString();
    return s ? `?${s}` : '';
  };

  return {
    auth: {
      login: (input: LoginInput) => request<AuthResult>('POST', '/auth/login', input),
      register: (input: RegisterInput) => request<AuthResult>('POST', '/auth/register', input),
      requestOtp: (phone: string) => request<{ sent: true }>('POST', '/auth/otp/request', { phone }),
      verifyOtp: (phone: string, code: string) =>
        request<AuthResult>('POST', '/auth/otp/verify', { phone, code }),
      checkOtp: (phone: string, code: string) =>
        request<{ sent: true }>('POST', '/auth/otp/check', { phone, code }),
      forgotPassword: (emailOrPhone: string) =>
        request<{ sent: true }>('POST', '/auth/forgot-password', { emailOrPhone }),
      resetPassword: (emailOrPhone: string, code: string, newPassword: string) =>
        request<{ sent: true }>('POST', '/auth/reset-password', { emailOrPhone, code, newPassword }),
    },
    emotions: {
      list: () => request<Emotion[]>('GET', '/emotions'),
      get: (id: string) => request<EmotionDetail | null>('GET', `/emotions/${encodeURIComponent(id)}`),
      create: (input: EmotionDetail) => request<EmotionDetail>('POST', '/emotions', input),
      update: (id: string, input: Partial<EmotionDetail>) =>
        request<EmotionDetail>('PUT', `/emotions/${encodeURIComponent(id)}`, input),
      remove: (id: string) => request<void>('DELETE', `/emotions/${encodeURIComponent(id)}`),
    },
    posts: {
      list: (emotion?: string) => request<Post[]>('GET', `/posts${q({ emotion })}`),
      create: (input: CreatePostInput) => request<Post>('POST', '/posts', input),
      toggleLike: (id: number) => request<Post>('POST', `/posts/${id}/like`),
      addComment: (id: number, input: CreateCommentInput) =>
        request<Comment>('POST', `/posts/${id}/comments`, input),
    },
    events: {
      list: () => request<CalEvent[]>('GET', '/events'),
      create: (input: CreateEventInput) => request<CalEvent>('POST', '/events', input),
      update: (id: string, input: UpdateEventInput) => request<CalEvent>('PUT', `/events/${id}`, input),
      remove: (id: string) => request<void>('DELETE', `/events/${id}`),
    },
    learning: {
      topics: () => request<Topic[]>('GET', '/learning/topics'),
      createTopic: (input: CreateTopicInput) => request<Topic>('POST', '/learning/topics', input),
      updateTopic: (id: string, input: UpdateTopicInput) =>
        request<Topic>('PUT', `/learning/topics/${encodeURIComponent(id)}`, input),
      removeTopic: (id: string) => request<void>('DELETE', `/learning/topics/${encodeURIComponent(id)}`),
    },
    tools: {
      get: () => request<ToolsContent>('GET', '/tools'),
      update: (input: ToolsContent) => request<ToolsContent>('PUT', '/tools', input),
    },
    profile: {
      get: () => request<UserProfile>('GET', '/me'),
      update: (input: UpdateProfileInput) => request<UserProfile>('PUT', '/me', input),
    },
    misc: {
      schools: () => request<string[]>('GET', '/schools'),
    },
    admin: {
      users: {
        list: (status?: UserStatus) => request<UserProfile[]>('GET', `/admin/users${q({ status })}`),
        approve: (id: string) => request<UserProfile>('POST', `/admin/users/${encodeURIComponent(id)}/approve`),
        reject: (id: string) => request<UserProfile>('POST', `/admin/users/${encodeURIComponent(id)}/reject`),
      },
    },
    media: {
      upload: (file: Blob, filename: string, category: MediaCategory) =>
        uploadFile(`/media/upload${q({ category })}`, file, filename),
    },
    screenIntros: {
      list: () => request<ScreenIntroVideo[]>('GET', '/screen-intro-videos'),
      get: (screenKey: string) =>
        getOrNull<ScreenIntroVideo>(`/screen-intro-videos/${encodeURIComponent(screenKey)}`),
      update: (screenKey: string, video: MediaItem) =>
        request<ScreenIntroVideo>('PUT', `/screen-intro-videos/${encodeURIComponent(screenKey)}`, video),
      remove: (screenKey: string) =>
        request<void>('DELETE', `/screen-intro-videos/${encodeURIComponent(screenKey)}`),
    },
  };
}

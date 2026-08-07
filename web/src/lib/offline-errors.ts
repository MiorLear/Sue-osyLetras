import { ApiError } from '@explorarte/shared';

import { clearUserCache, getCacheUser } from '@/lib/offline-cache';

// Telling failure modes apart is the whole point of this file. A screen that
// cannot distinguish them cannot choose the right message, and — worse — the
// offline layer cannot choose the right *behaviour*: a network failure is
// retried and the cache is kept, a dead session must purge and log out. They
// are opposites, so conflating them is a bug either way round (BUG-09).

/** Machine-readable reason attached to every error this layer produces. */
export type OfflineErrorCode =
  | 'offline-empty'
  | 'session-expired'
  | 'network'
  | 'rate-limited'
  | 'conflict'
  | 'server'
  | 'unknown';

/** Offline, and nothing cached to fall back on. Not a failure — an empty state. */
export class OfflineEmptyError extends Error {
  readonly code = 'offline-empty' as const;
  constructor(message = 'offline: no cached content') {
    super(message);
    this.name = 'OfflineEmptyError';
  }
}

/**
 * The session is dead: the account was rejected or the token revoked. Since
 * Ola 1 the API answers 403 for this on ANY endpoint, so it can arrive from a
 * background read, not only from a login attempt.
 */
export class SessionExpiredError extends Error {
  readonly code = 'session-expired' as const;
  /** From the problem+json body, when the server said which. */
  readonly reason?: string;
  constructor(message = 'session expired', reason?: string) {
    super(message);
    this.name = 'SessionExpiredError';
    this.reason = reason;
  }
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  /** Preserved across the Ola 1 move to problem+json. */
  detail?: string;
  code?: string;
  accountStatus?: string;
  retryAfterSeconds?: number;
}

/** Parses an RFC 7807 body out of an ApiError. Tolerates non-JSON bodies. */
export function problemDetail(err: unknown): ProblemDetail | null {
  if (!(err instanceof ApiError) || !err.body) return null;
  try {
    const parsed = JSON.parse(err.body) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as ProblemDetail) : null;
  } catch {
    return null;
  }
}

export interface Classification {
  code: OfflineErrorCode;
  /** True when retrying later could plausibly succeed. */
  retryable: boolean;
  /** True when the session must be purged and the user sent to login. */
  fatalToSession: boolean;
  status?: number;
  /** From `Retry-After` / `retryAfterSeconds` on a 429. */
  retryAfterSeconds?: number;
  detail?: string;
}

/**
 * Sorts a thrown value into what the offline layer must do about it.
 *
 * The important line is 403 vs everything else. A `fetch` that rejects is a
 * transport failure: keep the cache, retry on reconnect. A 403 is the server
 * telling us this session is over — retrying is pointless and keeping the
 * cached data on a shared tablet is exactly the leak the namespacing exists to
 * prevent.
 */
export function classifyError(err: unknown): Classification {
  if (err instanceof SessionExpiredError) {
    return { code: 'session-expired', retryable: false, fatalToSession: true };
  }
  if (err instanceof OfflineEmptyError) {
    return { code: 'offline-empty', retryable: true, fatalToSession: false };
  }

  if (!(err instanceof ApiError)) {
    // TypeError from fetch, an abort, a DNS failure: we never reached the API.
    return { code: 'network', retryable: true, fatalToSession: false };
  }

  const problem = problemDetail(err);
  const detail = problem?.detail ?? err.body ?? err.message;
  const status = err.status;

  if (status === 403) {
    return {
      code: 'session-expired',
      retryable: false,
      fatalToSession: true,
      status,
      detail,
    };
  }
  if (status === 401) {
    // The shared client's onUnauthorized already clears the token; treat it the
    // same way here so the cache is purged too.
    return { code: 'session-expired', retryable: false, fatalToSession: true, status, detail };
  }
  if (status === 429) {
    return {
      code: 'rate-limited',
      retryable: true,
      fatalToSession: false,
      status,
      detail,
      retryAfterSeconds: problem?.retryAfterSeconds,
    };
  }
  if (status === 409) {
    return { code: 'conflict', retryable: false, fatalToSession: false, status, detail };
  }
  if (status >= 500) {
    return { code: 'server', retryable: true, fatalToSession: false, status, detail };
  }
  return { code: 'unknown', retryable: false, fatalToSession: false, status, detail };
}

/** Convenience predicate for callers that only care about the fatal case. */
export function isDeadSession(err: unknown): boolean {
  return classifyError(err).fatalToSession;
}

// ── dead-session handling ────────────────────────────────────────────────────

type DeadSessionHandler = (reason?: string) => void;

let handler: DeadSessionHandler | null = null;
let purging = false;

/**
 * Lets the auth layer own the redirect. Registering replaces the default, which
 * clears the persisted session and navigates to /login.
 */
export function onDeadSession(fn: DeadSessionHandler | null): void {
  handler = fn;
}

function defaultHandler(): void {
  try {
    localStorage.removeItem('explorarte_token');
    localStorage.removeItem('explorarte_user');
  } catch {
    /* storage may be unavailable */
  }
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

/**
 * Purges this user's offline data and hands off to the auth layer. Idempotent
 * within a tick: several screens can hit a 403 at once and we must only wipe
 * and redirect once.
 */
export async function reportDeadSession(reason?: string): Promise<void> {
  if (purging) return;
  purging = true;
  const userId = getCacheUser();
  try {
    await clearUserCache(userId);
  } finally {
    (handler ?? defaultHandler)(reason);
    // Released on the next tick so a burst of concurrent 403s collapses into
    // one purge, without wedging the flag for the rest of the session.
    setTimeout(() => {
      purging = false;
    }, 0);
  }
}

/** Test-only. */
export function __resetDeadSession(): void {
  handler = null;
  purging = false;
}

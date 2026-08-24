import {
  STORES,
  deleteRecord,
  getRecord,
  isIdbAvailable,
  putRecord,
  type AuthTokenRecord,
} from '@/lib/idb';

const CURRENT = 'current' as const;
let tokenInMemory: string | null = null;

export interface StoredSession {
  token: string;
  userId: string;
}

export function getAuthToken(): string | null {
  return tokenInMemory;
}

export async function restoreAuthToken(): Promise<StoredSession | null> {
  if (!isIdbAvailable()) return null;
  try {
    const row = await getRecord<AuthTokenRecord>(STORES.authToken, CURRENT);
    if (!row?.token || !row.userId) return null;
    tokenInMemory = row.token;
    return { token: row.token, userId: row.userId };
  } catch {
    return null;
  }
}

export async function storeAuthToken(token: string, userId: string): Promise<void> {
  tokenInMemory = token;
  if (!isIdbAvailable()) return;
  try {
    await putRecord<AuthTokenRecord>(STORES.authToken, {
      id: CURRENT,
      token,
      userId,
      updatedAt: Date.now(),
    });
  } catch {
    // A private browser may reject IDB. The current tab can still work from
    // memory; only persistence/background replay is unavailable.
  }
}

export async function clearAuthToken(): Promise<void> {
  tokenInMemory = null;
  if (!isIdbAvailable()) return;
  try {
    await deleteRecord(STORES.authToken, CURRENT);
  } catch {
    /* memory is already safe; persistence cleanup is best effort */
  }
}

export function __resetAuthToken(): void {
  tokenInMemory = null;
}

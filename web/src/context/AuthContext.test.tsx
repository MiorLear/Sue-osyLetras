import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AuthResult } from '@explorarte/shared';

const api = vi.hoisted(() => ({ profile: { get: vi.fn() } }));
vi.mock('@/lib/api', () => ({ api }));
vi.mock('@/lib/outbox', () => ({ refreshCounts: vi.fn(async () => ({ pending: 0, failed: 0 })) }));
vi.mock('@/lib/storage-persist', () => ({ requestPersistentStorage: vi.fn(async () => true) }));

import { AuthProvider, useAuth } from '@/context/AuthContext';
import {
  STORES,
  USER_SCOPED_STORES,
  clearEverything,
  getAllByUser,
  getRecord,
  putRecord,
  type OutboxRecord,
} from '@/lib/idb';
import { MEDIA_CACHE } from '@/lib/media-origins';
import { fakeCaches, installFakeCacheStorage } from '@/test/cache-storage';
import { __resetAuthToken } from '@/lib/auth-token';
import { setCacheUser } from '@/lib/offline-cache';

const SESSION: AuthResult = {
  token: 'tok-ana',
  user: {
    id: 'ana',
    name: 'Ana',
    lastname: 'López',
    email: 'ana@example.test',
    phone: '+503 7000 0000',
    institucion: 'Escuela',
    ubicacion: 'San Salvador',
    role: 'teacher',
    status: 'approved',
  },
};

function Harness() {
  const { authed, signIn, signOut } = useAuth();
  return (
    <>
      <span>{authed ? 'dentro' : 'fuera'}</span>
      <button onClick={() => void signIn(SESSION)}>entrar</button>
      <button onClick={() => void signOut()}>salir</button>
    </>
  );
}

beforeEach(async () => {
  installFakeCacheStorage();
  await clearEverything();
  __resetAuthToken();
  setCacheUser(null);
  localStorage.clear();
  vi.clearAllMocks();
});

describe('AuthProvider · tablet compartida', () => {
  it('logout purga credencial, stores de la usuaria y medios sin desregistrar el SW', async () => {
    const unregister = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistrations: vi.fn(async () => [{ unregister }]) },
    });
    render(<AuthProvider><Harness /></AuthProvider>);
    await screen.findByText('fuera');
    fireEvent.click(screen.getByText('entrar'));
    await screen.findByText('dentro');

    await putRecord(STORES.outbox, {
      id: 'm-1', userId: 'ana', kind: 'profile.update', payload: {}, chainKey: 'profile',
      createdAt: 0, attempts: 0, nextAttemptAt: 0, status: 'pending',
    } satisfies OutboxRecord);
    await putRecord(STORES.mediaIndex, {
      id: 'media-1', url: 'https://example.test/a.pdf', sizeBytes: 1, downloadedAt: 0,
    });
    const cache = await fakeCaches().open(MEDIA_CACHE);
    await cache.put('https://example.test/a.pdf', new Response('a'));

    fireEvent.click(screen.getByText('salir'));
    await screen.findByText('fuera');
    await waitFor(async () => {
      for (const store of USER_SCOPED_STORES) {
        expect(await getAllByUser(store, 'ana')).toEqual([]);
      }
      expect(await getRecord(STORES.mediaIndex, 'media-1')).toBeUndefined();
      expect(await fakeCaches().has(MEDIA_CACHE)).toBe(false);
    });
    expect(localStorage.getItem('explorarte_token')).toBeNull();
    expect(localStorage.getItem('explorarte_user')).toBeNull();
    expect(unregister).not.toHaveBeenCalled();
  });
});

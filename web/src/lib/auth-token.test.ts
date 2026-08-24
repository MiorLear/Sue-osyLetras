import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetAuthToken,
  clearAuthToken,
  getAuthToken,
  restoreAuthToken,
  storeAuthToken,
} from '@/lib/auth-token';
import { STORES, clearAllUserData, clearEverything, getRecord, type AuthTokenRecord } from '@/lib/idb';

beforeEach(async () => {
  await clearEverything();
  __resetAuthToken();
  localStorage.clear();
});

describe('auth-token · memoria e IndexedDB', () => {
  it('queda disponible en memoria y se refleja en IndexedDB', async () => {
    await storeAuthToken('tok-abc', 'ana');

    expect(getAuthToken()).toBe('tok-abc');
    await expect(getRecord<AuthTokenRecord>(STORES.authToken, 'current')).resolves.toMatchObject({
      token: 'tok-abc',
      userId: 'ana',
    });
  });

  it('restaura la sesión después de perder la memoria del módulo', async () => {
    await storeAuthToken('tok-abc', 'ana');
    __resetAuthToken();

    await expect(restoreAuthToken()).resolves.toEqual({ token: 'tok-abc', userId: 'ana' });
    expect(getAuthToken()).toBe('tok-abc');
  });

  it('cerrar sesión limpia memoria y persistencia', async () => {
    await storeAuthToken('tok-abc', 'ana');
    await clearAuthToken();

    expect(getAuthToken()).toBeNull();
    await expect(getRecord(STORES.authToken, 'current')).resolves.toBeUndefined();
  });

  it('localStorage nunca se considera una fuente de credenciales', async () => {
    localStorage.setItem('explorarte_token', 'robado-o-viejo');

    await expect(restoreAuthToken()).resolves.toBeNull();
    expect(getAuthToken()).toBeNull();
  });

  it('la purga de la usuaria también elimina su sesión', async () => {
    await storeAuthToken('tok-abc', 'ana');
    await clearAllUserData('ana');
    __resetAuthToken();

    await expect(restoreAuthToken()).resolves.toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearEverything } from '@/lib/idb';
import { setCacheUser } from '@/lib/offline-cache';
import {
  SAFE_QUOTA_FRACTION,
  fitsInQuota,
  lastPersistOutcome,
  requestPersistentStorage,
  storageUsage,
} from '@/lib/storage-persist';

// Pedirle al navegador que no borre lo que la docente descargó a propósito.
// Casi todo aquí es degradación: la API no existe en Safari, puede lanzar, y
// nada de eso puede impedir usar la app.

beforeEach(async () => {
  setCacheUser('ana');
  await clearEverything();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestPersistentStorage', () => {
  it('anota que el navegador no la implementa, en vez de lanzar', async () => {
    vi.stubGlobal('navigator', {});

    const outcome = await requestPersistentStorage();

    expect(outcome).toMatchObject({ supported: false, granted: false });
    await expect(lastPersistOutcome()).resolves.toMatchObject({ supported: false });
  });

  it('guarda que fue concedida', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn().mockResolvedValue(true), persisted: vi.fn().mockResolvedValue(false) },
    });

    await expect(requestPersistentStorage()).resolves.toMatchObject({
      granted: true,
      supported: true,
    });
    await expect(lastPersistOutcome()).resolves.toMatchObject({ granted: true });
  });

  it('guarda que fue denegada', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn().mockResolvedValue(false), persisted: vi.fn().mockResolvedValue(false) },
    });

    await expect(requestPersistentStorage()).resolves.toMatchObject({
      granted: false,
      supported: true,
    });
  });

  // En algunos navegadores cada petición es un aviso más para la usuaria.
  it('no vuelve a pedirla si ya estaba concedida', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', {
      storage: { persist, persisted: vi.fn().mockResolvedValue(true) },
    });

    await expect(requestPersistentStorage()).resolves.toMatchObject({ granted: true });
    expect(persist).not.toHaveBeenCalled();
  });

  it('una excepción del navegador no se propaga', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn().mockRejectedValue(new Error('nope')), persisted: vi.fn() },
    });

    await expect(requestPersistentStorage()).resolves.toMatchObject({ granted: false });
  });
});

describe('storageUsage', () => {
  it('devuelve uso y cuota', async () => {
    vi.stubGlobal('navigator', {
      storage: { estimate: vi.fn().mockResolvedValue({ usage: 1000, quota: 5000 }) },
    });

    await expect(storageUsage()).resolves.toEqual({ usage: 1000, quota: 5000, supported: true });
  });

  it('lo declara cuando el navegador no lo dice', async () => {
    vi.stubGlobal('navigator', {});
    await expect(storageUsage()).resolves.toEqual({ supported: false });
  });
});

describe('fitsInQuota', () => {
  const usage = { usage: 0, quota: 1000, supported: true };

  it('cabe por debajo de la fracción segura', () => {
    expect(fitsInQuota(1000 * SAFE_QUOTA_FRACTION - 1, usage)).toBe(true);
  });

  // Pasarse no da un error: el navegador empieza a desalojar, y lo primero que
  // cae puede ser el contenido de la clase de mañana.
  it('no cabe por encima', () => {
    expect(fitsInQuota(1000 * SAFE_QUOTA_FRACTION + 1, usage)).toBe(false);
  });

  it('cuenta lo que ya está ocupado', () => {
    expect(fitsInQuota(500, { usage: 500, quota: 1000, supported: true })).toBe(false);
  });

  // Sin dato de cuota no se puede decidir, y bloquear a ciegas dejaría sin
  // descargas a navegadores que sí tenían espacio.
  it('sin cuota conocida no bloquea', () => {
    expect(fitsInQuota(999_999, { supported: false })).toBe(true);
  });
});

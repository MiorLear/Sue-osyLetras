import { describe, expect, it } from 'vitest';

// Smoke del arnes: la migracion a PWA mueve el outbox y la cache de contenido a
// IndexedDB, asi que los tests de web/ tienen que correr con jsdom Y con
// IndexedDB disponible antes de escribir una sola linea de ese codigo
// (MAINT-01). Si este test se cae, el arnes esta mal montado.

describe('entorno de test de web/', () => {
  it('corre en jsdom', () => {
    expect(typeof window).toBe('object');
    expect(typeof document.createElement).toBe('function');
  });

  it('tiene localStorage', () => {
    localStorage.setItem('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
  });

  it('tiene IndexedDB (fake-indexeddb)', async () => {
    expect(typeof indexedDB).toBe('object');
    expect(typeof IDBKeyRange).toBe('function');

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('harness-smoke', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('outbox', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite');
      tx.objectStore('outbox').put({ id: 'm-1', kind: 'profile.update' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const stored = await new Promise<{ kind: string }>((resolve, reject) => {
      const req = db.transaction('outbox').objectStore('outbox').get('m-1');
      req.onsuccess = () => resolve(req.result as { kind: string });
      req.onerror = () => reject(req.error);
    });

    expect(stored.kind).toBe('profile.update');
    db.close();
  });
});

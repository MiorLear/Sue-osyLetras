// Entorno base de los tests de web/: jsdom (lo pone vitest.config.ts) mas
// IndexedDB, que jsdom no implementa. fake-indexeddb/auto instala indexedDB e
// IDBKeyRange como globales.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

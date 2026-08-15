// Doble en memoria de Cache Storage para los tests.
//
// jsdom no implementa la Cache API, igual que no implementa IndexedDB — para
// esa ya hay `fake-indexeddb/auto` en setup.ts, pero para esta no existe un
// paquete equivalente que merezca la pena, así que va escrita aquí.
//
// Cubre lo que usa media-cache.ts y nada más: open/match/put/delete/keys, más
// dos palancas que los tests necesitan y un navegador no da: forzar
// QuotaExceededError en el siguiente put (para probar la evicción) y quitar
// `caches` del todo (para probar el navegador que no la trae, como Firefox en
// privado).
//
// Las respuestas se clonan al guardar y al leer. Sin eso, el primer test que
// consuma un cuerpo dejaría la entrada inservible para el siguiente, que es
// exactamente el fallo que un doble no debería introducir.

class FakeCache {
  private entries = new Map<string, Response>();

  constructor(private readonly onPut: () => void) {}

  private static keyOf(request: RequestInfo | URL): string {
    if (typeof request === 'string') return request;
    if (request instanceof URL) return request.href;
    return (request as Request).url;
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const hit = this.entries.get(FakeCache.keyOf(request));
    return hit ? hit.clone() : undefined;
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.onPut();
    this.entries.set(FakeCache.keyOf(request), response.clone());
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(FakeCache.keyOf(request));
  }

  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  /** Solo para aserciones de los tests; el navegador no expone esto. */
  get size(): number {
    return this.entries.size;
  }
}

class FakeCacheStorage {
  private caches = new Map<string, FakeCache>();
  private failNextPuts = 0;

  async open(name: string): Promise<FakeCache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new FakeCache(() => this.beforePut());
      this.caches.set(name, cache);
    }
    return cache;
  }

  async has(name: string): Promise<boolean> {
    return this.caches.has(name);
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }

  private beforePut(): void {
    if (this.failNextPuts > 0) {
      this.failNextPuts -= 1;
      throw new DOMException('cuota agotada', 'QuotaExceededError');
    }
  }

  // ── palancas de test ──────────────────────────────────────────────────────

  /** Hace que los próximos `times` put fallen por cuota. */
  failOnQuota(times = 1): void {
    this.failNextPuts = times;
  }

  reset(): void {
    this.caches.clear();
    this.failNextPuts = 0;
  }
}

let installed: FakeCacheStorage | null = null;

/** Instala el doble en `globalThis.caches` y lo devuelve. */
export function installFakeCacheStorage(): FakeCacheStorage {
  const fake = new FakeCacheStorage();
  Object.defineProperty(globalThis, 'caches', {
    value: fake,
    configurable: true,
    writable: true,
  });
  installed = fake;
  return fake;
}

/** Quita `caches` para probar el navegador que no la trae. */
export function uninstallCacheStorage(): void {
  Reflect.deleteProperty(globalThis as unknown as Record<string, unknown>, 'caches');
  installed = null;
}

export function fakeCaches(): FakeCacheStorage {
  if (!installed) throw new Error('installFakeCacheStorage() no se ha llamado');
  return installed;
}

export type { FakeCache, FakeCacheStorage };

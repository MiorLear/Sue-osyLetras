import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as MediaSync from '@/lib/media-sync';

// La pasada de sincronizacion proactiva: baja el JSON de todo el contenido y
// los ficheros que referencia. Es el modulo que decide QUE se guarda offline,
// asi que su contrato (claves de cache, criterio de frescura, aislamiento de
// fallos) tiene que sobrevivir intacto al port a IndexedDB / Cache Storage.

const cacheStore: Record<string, unknown> = {};

// El guardia de frescura (lastFullSyncAt) vive en AsyncStorage, igual que la
// cola offline: en Node hay que mockearlo.
const kv: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => kv[k] ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      kv[k] = v;
    }),
    removeItem: vi.fn(async (k: string) => {
      delete kv[k];
    }),
  },
}));

vi.mock('@/lib/offline-cache', () => ({
  writeCache: vi.fn(async (key: string, data: unknown) => {
    cacheStore[key] = data;
  }),
  readCache: vi.fn(async () => undefined),
  readAllCached: vi.fn(async () => ({})),
}));

vi.mock('@/lib/sync-status', () => ({
  withSync: <T,>(task: () => Promise<T>) => task(),
}));

const offlineStorage = {
  needsUpdate: vi.fn(async (_id: string, _version: string | undefined) => true),
  download: vi.fn(async (_id: string, _url: string, _opts?: { version?: string }) => 'file:///downloads/x'),
};
vi.mock('@/lib/offlineStorage', () => offlineStorage);

const media = (id: string, sizeBytes: number) => ({ id, url: `https://cdn/${id}.pdf`, sizeBytes });

const apiMock = {
  screenIntros: { get: vi.fn(async (key: string) => ({ screen: key, video: media(`intro-${key}`, 10) })) },
  emotions: {
    list: vi.fn(async () => [{ id: 'alegria' }]),
    get: vi.fn(async (id: string) => ({ id, content: { stories: [media(`story-${id}`, 20)] } })),
  },
  tools: {
    get: vi.fn(async () => ({
      downloadables: [media('dl-1', 30)],
      activityGuides: [media('guide-1', 40)],
      manualDocument: media('manual', 50),
    })),
  },
  learning: {
    topics: vi.fn(async () => [
      { id: 't1', subtopics: [{ pdfs: [media('pdf-1', 60)], videos: [media('vid-1', 70)], audios: [] }] },
    ]),
  },
};
vi.mock('@/lib/api', () => ({ api: apiMock }));

async function load(): Promise<typeof MediaSync> {
  for (const k of Object.keys(cacheStore)) delete cacheStore[k];
  for (const k of Object.keys(kv)) delete kv[k];
  vi.resetModules();
  return import('@/lib/media-sync');
}

beforeEach(() => {
  vi.clearAllMocks();
  offlineStorage.needsUpdate.mockResolvedValue(true);
  offlineStorage.download.mockResolvedValue('file:///downloads/x');
});

describe('media-sync · claves de cache', () => {
  it('escribe cada respuesta bajo la clave que leen las pantallas', async () => {
    const s = await load();
    await s.syncAllContent();

    // Estas claves estan duplicadas como literales en 8 pantallas (MAINT-08):
    // si cambian aqui sin cambiarlas alli, la app se queda en blanco offline.
    expect(Object.keys(cacheStore).sort()).toEqual(
      [
        'emotion:alegria',
        'emotions:list',
        'learning:topics',
        'screen-intro:emotions',
        'screen-intro:home',
        'screen-intro:learning',
        'screen-intro:tools',
        'tools',
      ].sort(),
    );
  });

  it('recorre las cuatro pantallas con intro', async () => {
    const s = await load();
    await s.syncAllContent();
    expect(apiMock.screenIntros.get.mock.calls.map((c) => c[0])).toEqual([
      'home',
      'emotions',
      'learning',
      'tools',
    ]);
  });
});
describe('media-sync · descarga de ficheros', () => {
  it('baja todos los medios referenciados, conservando el tamano para elementos legacy', async () => {
    const s = await load();
    await s.syncAllContent();

    const byId = Object.fromEntries(offlineStorage.download.mock.calls.map((c) => [c[0], c[2]]));
    expect(Object.keys(byId).sort()).toEqual(
      ['dl-1', 'guide-1', 'intro-emotions', 'intro-home', 'intro-learning', 'intro-tools', 'manual', 'pdf-1', 'story-alegria', 'vid-1'].sort(),
    );
    expect(byId['manual']).toEqual({ version: '50' });
  });

  it('usa etag antes que updatedAt y updatedAt antes que el tamano', async () => {
    apiMock.tools.get.mockResolvedValueOnce({
      downloadables: [
        { ...media('con-etag', 30), updatedAt: '2026-08-22T10:00:00.000Z', etag: '"revision-2"' },
        { ...media('con-fecha', 40), updatedAt: '2026-08-22T11:00:00.000Z' },
      ],
      activityGuides: [media('legacy', 50)],
      manualDocument: null,
    } as never);

    const s = await load();
    await s.syncAllContent();

    const versions = Object.fromEntries(offlineStorage.needsUpdate.mock.calls.map(([id, version]) => [id, version]));
    expect(versions['con-etag']).toBe('"revision-2"');
    expect(versions['con-fecha']).toBe('2026-08-22T11:00:00.000Z');
    expect(versions['legacy']).toBe('50');
  });

  it('detecta un reemplazo del mismo tamano cuando cambia el etag', async () => {
    const cachedVersions = new Map<string, string>();
    offlineStorage.needsUpdate.mockImplementation(async (id, version) => cachedVersions.get(id) !== version);
    offlineStorage.download.mockImplementation(async (id, _url, options) => {
      cachedVersions.set(id, options?.version ?? '');
      return 'file:///downloads/x';
    });
    apiMock.tools.get
      .mockResolvedValueOnce({
        downloadables: [],
        activityGuides: [],
        manualDocument: { ...media('manual-versionado', 50), etag: '"revision-1"' },
      } as never)
      .mockResolvedValueOnce({
        downloadables: [],
        activityGuides: [],
        manualDocument: { ...media('manual-versionado', 50), etag: '"revision-2"' },
      } as never);

    const s = await load();
    await s.syncAllContent();
    await s.syncAllContent();

    const downloads = offlineStorage.download.mock.calls.filter(([id]) => id === 'manual-versionado');
    expect(downloads.map(([, , options]) => options)).toEqual([
      { version: '"revision-1"' },
      { version: '"revision-2"' },
    ]);
  });

  it('no vuelve a bajar lo que ya esta fresco', async () => {
    offlineStorage.needsUpdate.mockResolvedValue(false);
    const s = await load();
    await s.syncAllContent();
    expect(offlineStorage.download).not.toHaveBeenCalled();
  });

  it('ignora los medios sin url o sin id', async () => {
    apiMock.tools.get.mockResolvedValueOnce({
      downloadables: [{ id: 'sin-url', url: '', sizeBytes: 1 }],
      activityGuides: [{ id: '', url: 'https://cdn/x.pdf', sizeBytes: 1 }],
      manualDocument: null,
    } as never);

    const s = await load();
    await s.syncAllContent();
    expect(offlineStorage.download.mock.calls.map((c) => c[0])).not.toContain('sin-url');
  });
});

describe('media-sync · aislamiento de fallos', () => {
  it('un fallo de descarga no aborta la pasada', async () => {
    offlineStorage.download.mockRejectedValueOnce(new Error('cdn 500'));
    const s = await load();
    await s.syncAllContent();
    expect(cacheStore['tools']).toBeDefined();
    expect(cacheStore['learning:topics']).toBeDefined();
  });

  it('si emociones revienta, tools y learning se cachean igual', async () => {
    apiMock.emotions.list.mockRejectedValueOnce(new Error('500'));
    const s = await load();
    await s.syncAllContent();

    expect(cacheStore['emotions:list']).toBeUndefined();
    expect(cacheStore['tools']).toBeDefined();
    expect(cacheStore['learning:topics']).toBeDefined();
  });

  it('si una emocion concreta revienta, las demas se cachean', async () => {
    apiMock.emotions.list.mockResolvedValueOnce([{ id: 'alegria' }, { id: 'miedo' }] as never);
    apiMock.emotions.get.mockRejectedValueOnce(new Error('404'));

    const s = await load();
    await s.syncAllContent();

    expect(cacheStore['emotion:alegria']).toBeUndefined();
    expect(cacheStore['emotion:miedo']).toBeDefined();
  });

  it('si una pantalla de intro revienta, las otras tres siguen', async () => {
    apiMock.screenIntros.get.mockRejectedValueOnce(new Error('500'));
    const s = await load();
    await s.syncAllContent();

    expect(cacheStore['screen-intro:home']).toBeUndefined();
    expect(cacheStore['screen-intro:tools']).toBeDefined();
  });
});

describe('media-sync · re-entrada', () => {
  it('dos pasadas concurrentes no duplican el trabajo', async () => {
    const s = await load();
    await Promise.all([s.syncAllContent(), s.syncAllContent()]);
    expect(apiMock.tools.get).toHaveBeenCalledTimes(1);
  });

  it('tras terminar, una nueva pasada si vuelve a correr', async () => {
    const s = await load();
    await s.syncAllContent();
    await s.syncAllContent();
    expect(apiMock.tools.get).toHaveBeenCalledTimes(2);
  });
});

describe('media-sync · pasada automatica acotada (SCALE-03)', () => {
  // La pasada completa corria en CADA cambio del flag `online` y recorria ~12
  // endpoints mas cada fichero referenciado. Una tablet saltando entre wifi y
  // datos machacaba el API y quemaba el plan de datos de la profesora.

  it('la pasada automatica trae el JSON pero no descarga medios', async () => {
    const s = await load();
    await s.maybeSyncContent();

    expect(cacheStore['tools']).toBeDefined();
    expect(cacheStore['learning:topics']).toBeDefined();
    expect(offlineStorage.download).not.toHaveBeenCalled();
  });

  it('una segunda pasada dentro de la ventana se salta entera', async () => {
    const s = await load();
    expect(await s.maybeSyncContent()).toBe(true);
    expect(await s.maybeSyncContent()).toBe(false);
    expect(apiMock.tools.get).toHaveBeenCalledTimes(1);
  });

  it('pasada la ventana vuelve a correr', async () => {
    const s = await load();
    await s.maybeSyncContent();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + s.SYNC_WINDOW_MS + 1_000);
    const ran = await s.maybeSyncContent();
    vi.useRealTimers();

    expect(ran).toBe(true);
    expect(apiMock.tools.get).toHaveBeenCalledTimes(2);
  });

  it('no sincroniza sola con conexion de pago', async () => {
    const s = await load();
    expect(await s.maybeSyncContent({ metered: true })).toBe(false);
    expect(apiMock.tools.get).not.toHaveBeenCalled();
  });

  it('la descarga de medios sigue disponible, pero iniciada por el usuario', async () => {
    const s = await load();
    await s.maybeSyncContent();
    expect(offlineStorage.download).not.toHaveBeenCalled();

    await s.syncAllContent();
    expect(offlineStorage.download.mock.calls.map((c) => c[0])).toContain('manual');
  });
});


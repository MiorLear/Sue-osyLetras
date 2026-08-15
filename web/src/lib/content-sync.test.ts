import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearEverything } from '@/lib/idb';
import { readAllCached, setCacheUser } from '@/lib/offline-cache';

// La pasada que llena la caché sin que nadie abra pantalla por pantalla.
//
// Lo que de verdad hay que fijar aquí es la separación de SCALE-03: la pasada
// automática NO puede descargar medios. Esa era la regresión cara — la versión
// RN bajaba cada PDF y cada video en cada flip de `online`, y quien pagaba esos
// megabytes era la docente.

const api = vi.hoisted(() => ({
  screenIntros: { get: vi.fn() },
  emotions: { list: vi.fn(), get: vi.fn() },
  tools: { get: vi.fn() },
  learning: { topics: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api }));

const mediaCache = vi.hoisted(() => ({
  download: vi.fn<(id: string, url: string, opts?: { version?: string }) => Promise<string>>(),
  needsUpdate: vi.fn<(id: string, version: string | undefined) => Promise<boolean>>(),
  listDownloaded: vi.fn<() => Promise<{ id: string }[]>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
}));
vi.mock('@/lib/media-cache', () => mediaCache);

import {
  SYNC_WINDOW_MS,
  __resetSyncWindow,
  collectMediaItems,
  maybeSyncContent,
  pruneOrphanedMedia,
  syncAllContent,
  syncContentJson,
} from '@/lib/content-sync';

const VIDEO = {
  id: 'intro-home',
  title: 'Bienvenida',
  url: 'http://localhost:3000/media/intros/home.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 1024,
};
const PDF = {
  id: 'manual',
  title: 'Manual',
  url: 'http://localhost:3000/media/tools/manual.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
};

function happyApi() {
  api.screenIntros.get.mockResolvedValue({ screenKey: 'home', video: VIDEO });
  api.emotions.list.mockResolvedValue([{ id: 'alegria', name: 'Alegría' }]);
  api.emotions.get.mockResolvedValue({
    id: 'alegria',
    name: 'Alegría',
    content: { description: '', classroom: '', questions: [], activities: [], stories: [] },
  });
  api.tools.get.mockResolvedValue({
    manualDocument: PDF,
    activityGuides: [],
    downloadables: [],
    bibliography: [],
  });
  api.learning.topics.mockResolvedValue([]);
}

beforeEach(async () => {
  setCacheUser('ana');
  await clearEverything();
  vi.clearAllMocks();
  happyApi();
  mediaCache.download.mockResolvedValue('ok');
  mediaCache.needsUpdate.mockResolvedValue(true);
  mediaCache.listDownloaded.mockResolvedValue([]);
  mediaCache.remove.mockResolvedValue(undefined);
  await __resetSyncWindow();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('content-sync · la pasada automática', () => {
  it('escribe el JSON con las claves que leen las pantallas', async () => {
    const result = await syncContentJson();

    const cached = await readAllCached();
    expect(Object.keys(cached)).toEqual(
      expect.arrayContaining([
        'screen-intro:home',
        'screen-intro:emotions',
        'emotions:list',
        'emotion:alegria',
        'tools',
        'learning:topics',
      ]),
    );
    expect(result.complete).toBe(true);
  });

  // La mitad cara de SCALE-03.
  it('no descarga ni un archivo', async () => {
    await syncContentJson();
    expect(mediaCache.download).not.toHaveBeenCalled();
  });

  it('un endpoint caído no aborta el resto, y queda anotado con su id', async () => {
    api.tools.get.mockRejectedValue(new Error('502 Bad Gateway'));

    const result = await syncContentJson();

    expect(result.complete).toBe(false);
    expect(result.failures.map((f) => f.id)).toContain('tools');
    // El resto sí se guardó.
    expect(Object.keys(await readAllCached())).toContain('emotions:list');
  });

  it('una emoción rota no se lleva por delante a las demás', async () => {
    api.emotions.list.mockResolvedValue([{ id: 'alegria' }, { id: 'miedo' }]);
    api.emotions.get.mockImplementation(async (id: string) => {
      if (id === 'miedo') throw new Error('500');
      return { id, content: { stories: [] } };
    });

    const result = await syncContentJson();

    expect(result.failures.map((f) => f.id)).toContain('emotion:miedo');
    expect(Object.keys(await readAllCached())).toContain('emotion:alegria');
  });
});

describe('content-sync · la ventana anti-flapping', () => {
  it('la primera vez corre', async () => {
    await expect(maybeSyncContent()).resolves.toBe(true);
  });

  // Una tablet saltando entre wifi y datos cambia `online` muchas veces por
  // minuto: sin esto, cada salto vuelve a recorrer la API entera.
  it('no vuelve a correr dentro de la ventana', async () => {
    await maybeSyncContent();
    vi.clearAllMocks();

    await expect(maybeSyncContent()).resolves.toBe(false);
    expect(api.emotions.list).not.toHaveBeenCalled();
  });

  it('pasada la ventana vuelve a correr', async () => {
    await maybeSyncContent();
    vi.setSystemTime(new Date(Date.now() + SYNC_WINDOW_MS + 1000));

    await expect(maybeSyncContent()).resolves.toBe(true);
    vi.useRealTimers();
  });

  it('force la salta, porque ahí decidió la usuaria', async () => {
    await maybeSyncContent();
    await expect(maybeSyncContent({ force: true })).resolves.toBe(true);
  });

  it('con conexión medida no corre: esos megas los paga ella', async () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    await expect(maybeSyncContent()).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('content-sync · descarga masiva', () => {
  it('descarga los archivos que referencia el contenido', async () => {
    await syncAllContent();

    const ids = mediaCache.download.mock.calls.map((c) => c[0]);
    expect(ids).toContain(VIDEO.id);
    expect(ids).toContain(PDF.id);
  });

  it('no vuelve a bajar lo que ya está al día', async () => {
    mediaCache.needsUpdate.mockResolvedValue(false);
    await syncAllContent();
    expect(mediaCache.download).not.toHaveBeenCalled();
  });

  // BUG-10: antes se tragaba en silencio, y la pasada parecía haber funcionado
  // aunque el archivo no estuviera cuando hacía falta.
  it('una URL malformada se anota con su id y la pasada sigue', async () => {
    api.tools.get.mockResolvedValue({
      manualDocument: { ...PDF, url: 'no-soy-una-url' },
      activityGuides: [],
      downloadables: [],
      bibliography: [],
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await syncAllContent();

    expect(result.failures.map((f) => f.id)).toContain(PDF.id);
    expect(warn).toHaveBeenCalled();
    // El video sí se bajó: un archivo roto no aborta el resto.
    expect(mediaCache.download.mock.calls.map((c) => c[0])).toContain(VIDEO.id);
  });

  it('un archivo que falla al bajar no aborta a los siguientes', async () => {
    mediaCache.download.mockRejectedValueOnce(new Error('sin espacio'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await syncAllContent();

    expect(result.failures).toHaveLength(1);
    expect(mediaCache.download).toHaveBeenCalledTimes(2);
  });

  it('reporta el avance con el total de archivos', async () => {
    const seen: number[] = [];
    await syncAllContent((done, total) => {
      seen.push(done);
      expect(total).toBe(2);
    });
    expect(seen.at(-1)).toBe(2);
  });
});

describe('content-sync · limpieza de huérfanos (BUG-11)', () => {
  it('borra lo que ya no referencia ningún contenido', async () => {
    mediaCache.listDownloaded.mockResolvedValue([
      { id: VIDEO.id },
      { id: 'pdf-viejo-de-una-version-anterior' },
    ]);

    const result = await syncContentJson();

    expect(mediaCache.remove).toHaveBeenCalledExactlyOnceWith(
      'pdf-viejo-de-una-version-anterior',
    );
    expect(result.pruned).toEqual(['pdf-viejo-de-una-version-anterior']);
  });

  // Si la caché quedó a medias, "no referenciado" solo significa "no lo pude
  // leer", y borraríamos archivos buenos que habría que volver a bajar.
  it('no borra nada si la pasada no se completó', async () => {
    api.tools.get.mockRejectedValue(new Error('502'));
    mediaCache.listDownloaded.mockResolvedValue([{ id: 'huerfano' }]);

    const result = await syncContentJson();

    expect(result.complete).toBe(false);
    expect(mediaCache.remove).not.toHaveBeenCalled();
  });

  it('se puede pedir la limpieza a mano', async () => {
    await syncContentJson();
    mediaCache.listDownloaded.mockResolvedValue([{ id: 'huerfano' }]);

    await expect(pruneOrphanedMedia()).resolves.toEqual(['huerfano']);
  });
});

describe('content-sync · recorrido del contenido', () => {
  it('encuentra los medios estén donde estén en la respuesta', async () => {
    api.learning.topics.mockResolvedValue([
      { id: 't1', subtopics: [{ title: 'a', pdfs: [PDF], videos: [], audios: [] }] },
    ]);
    await syncContentJson();

    const ids = (await collectMediaItems()).map((m) => m.id);
    expect(ids).toContain(PDF.id);
    expect(ids).toContain(VIDEO.id);
  });

  it('no repite un archivo referenciado desde dos sitios', async () => {
    api.tools.get.mockResolvedValue({
      manualDocument: PDF,
      activityGuides: [PDF],
      downloadables: [PDF],
      bibliography: [],
    });
    await syncContentJson();

    const ids = (await collectMediaItems()).map((m) => m.id);
    expect(ids.filter((id) => id === PDF.id)).toHaveLength(1);
  });
});

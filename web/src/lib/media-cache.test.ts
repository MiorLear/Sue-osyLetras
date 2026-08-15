import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORES, clearEverything, getRecord, type MediaIndexRecord } from '@/lib/idb';
import {
  MediaDownloadError,
  download,
  getLocalBlob,
  getLocalUrl,
  isCacheStorageAvailable,
  isDownloaded,
  listDownloaded,
  needsUpdate,
  remove,
  totalDownloadedBytes,
} from '@/lib/media-cache';
import { MEDIA_CACHE } from '@/lib/media-origins';
import {
  fakeCaches,
  installFakeCacheStorage,
  uninstallCacheStorage,
} from '@/test/cache-storage';

// El único módulo del subsistema offline que estaba atado a la plataforma. Lo
// que se prueba aquí es sobre todo lo que el port tenía que arreglar respecto a
// la versión RN: el tamaño medido en vez del anunciado (BUG-12) y la frescura
// por validador HTTP en vez de por tamaño (BUG-05).

const URL_PDF = 'http://localhost:3000/media/tools/manual.pdf';
const URL_MP4 = 'http://localhost:3000/media/learning/clase.mp4';

/** Respuesta con cuerpo real, para poder contar bytes de verdad. */
function fileResponse(
  bytes: number,
  init: { type?: string; etag?: string; lastModified?: string; declared?: number } = {},
): Response {
  const headers = new Headers({ 'Content-Type': init.type ?? 'application/pdf' });
  const declared = init.declared ?? bytes;
  headers.set('Content-Length', String(declared));
  if (init.etag) headers.set('ETag', init.etag);
  if (init.lastModified) headers.set('Last-Modified', init.lastModified);
  return new Response(new Uint8Array(bytes), { status: 200, headers });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  installFakeCacheStorage();
  await clearEverything();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('media-cache · descargar y leer sin conexión', () => {
  it('guarda el archivo y lo devuelve después sin volver a la red', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(1024));

    await expect(download('manual', URL_PDF)).resolves.toBe(URL_PDF);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(isDownloaded('manual')).resolves.toBe(true);
    await expect(getLocalUrl('manual')).resolves.toBe(URL_PDF);

    const blob = await getLocalBlob('manual');
    expect(blob?.size).toBe(1024);
    // Ni una petición más: los bytes salieron de la caché.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Devolver la URL canónica y no un blob: es lo que permite que el service
  // worker responda a las peticiones Range y el video se pueda adelantar.
  it('getLocalUrl devuelve la URL original, no un blob:', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(64, { type: 'video/mp4' }));
    await download('clase', URL_MP4);

    const url = await getLocalUrl('clase');
    expect(url).toBe(URL_MP4);
    expect(url).not.toMatch(/^blob:/);
  });

  it('guarda bajo la URL canónica, que es la que el worker va a interceptar', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(32));
    await download('manual', URL_PDF);

    const cache = await fakeCaches().open(MEDIA_CACHE);
    await expect(cache.match(URL_PDF)).resolves.toBeDefined();
  });

  it('lo que no está descargado no existe', async () => {
    await expect(isDownloaded('fantasma')).resolves.toBe(false);
    await expect(getLocalUrl('fantasma')).resolves.toBeNull();
    await expect(getLocalBlob('fantasma')).resolves.toBeNull();
  });

  // El navegador puede vaciar Cache Storage por presión de almacenamiento sin
  // tocar IndexedDB. Si solo mirásemos el índice, diríamos que está descargado
  // y la pantalla mostraría un archivo que ya no existe.
  it('el índice sin bytes no cuenta como descargado', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(16));
    await download('manual', URL_PDF);

    const cache = await fakeCaches().open(MEDIA_CACHE);
    await cache.delete(URL_PDF);

    await expect(isDownloaded('manual')).resolves.toBe(false);
    await expect(getLocalUrl('manual')).resolves.toBeNull();
  });
});

describe('media-cache · progreso y tamaño (BUG-12)', () => {
  it('reporta avance contra Content-Length', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(2048));
    const seen: number[] = [];

    await download('manual', URL_PDF, {
      onProgress: (p) => {
        seen.push(p.loaded);
        expect(p.total).toBe(2048);
      },
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)).toBe(2048);
  });

  // El fallo que motiva BUG-12: se guardaba el tamaño que anunciaba el
  // servidor, así que el contador de almacenamiento se iba desviando de lo que
  // el dispositivo ocupaba de verdad.
  it('guarda los bytes medidos, no los anunciados', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(500, { declared: 999_999 }));
    await download('manual', URL_PDF);

    const meta = await getRecord<MediaIndexRecord>(STORES.mediaIndex, 'manual');
    expect(meta?.sizeBytes).toBe(500);
    await expect(totalDownloadedBytes()).resolves.toBe(500);
  });

  it('suma el total de todo lo descargado', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(100));
    await download('a', URL_PDF);
    fetchMock.mockResolvedValueOnce(fileResponse(250, { type: 'video/mp4' }));
    await download('b', URL_MP4);

    await expect(totalDownloadedBytes()).resolves.toBe(350);
    await expect(listDownloaded()).resolves.toHaveLength(2);
  });
});

describe('media-cache · frescura (BUG-05)', () => {
  it('lo que no está descargado siempre necesita actualizarse', async () => {
    await expect(needsUpdate('fantasma', '123')).resolves.toBe(true);
  });

  it('un 304 confirma la copia local', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(100, { etag: '"v1"' }));
    await download('manual', URL_PDF);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    await expect(needsUpdate('manual', undefined)).resolves.toBe(false);
  });

  // El defecto exacto de BUG-05: la frescura se decidía por tamaño, así que un
  // archivo corregido que pesaba igual no se volvía a bajar nunca.
  it('un archivo del mismo tamaño pero cambiado sí se detecta', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(100, { etag: '"v1"' }));
    await download('manual', URL_PDF);

    fetchMock.mockResolvedValueOnce(fileResponse(100, { etag: '"v2"' }));
    await expect(needsUpdate('manual', undefined)).resolves.toBe(true);
  });

  it('un servidor que ignora la condicional no provoca re-descargas eternas', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(100, { etag: '"v1"' }));
    await download('manual', URL_PDF);

    // Mismo validador, respuesta 200: el servidor no implementa condicionales.
    fetchMock.mockResolvedValueOnce(fileResponse(100, { etag: '"v1"' }));
    await expect(needsUpdate('manual', undefined)).resolves.toBe(false);
  });

  // El ETag del servidor y la versión del llamador (hoy sizeBytes) son cosas
  // distintas. Guardadas en el mismo campo, la siguiente comprobación compara
  // '"v1"' contra '100', nunca coinciden, y el archivo se vuelve a bajar cada
  // vez que alguien abre la pantalla.
  it('el validador del servidor no pisa la versión del llamador', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(100, { etag: '"v1"' }));
    await download('manual', URL_PDF, { version: '100' });

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));

    await expect(needsUpdate('manual', '100')).resolves.toBe(false);
  });

  it('si el llamador ya sabe que cambió, no se pregunta al servidor', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(100));
    await download('manual', URL_PDF, { version: '100' });

    fetchMock.mockClear();
    await expect(needsUpdate('manual', '250')).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Una re-descarga innecesaria le cuesta datos móviles a la docente, así que
  // ante la duda se conserva lo que hay.
  it('un fallo de red al revalidar deja la copia como buena', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(100, { etag: '"v1"' }));
    await download('manual', URL_PDF);

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(needsUpdate('manual', undefined)).resolves.toBe(false);
  });
});

describe('media-cache · cuota y evicción', () => {
  // Sin esto, la primera docente que llenara la cuota vería fallar todas las
  // descargas siguientes para siempre.
  it('hace sitio borrando lo menos usado en vez de fallar', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(100));
    await download('viejo', URL_PDF);

    fakeCaches().failOnQuota(1);
    fetchMock.mockResolvedValueOnce(fileResponse(200, { type: 'video/mp4' }));
    await expect(download('nuevo', URL_MP4)).resolves.toBe(URL_MP4);

    await expect(isDownloaded('nuevo')).resolves.toBe(true);
    await expect(isDownloaded('viejo')).resolves.toBe(false);
  });

  it('sin nada que borrar, el error se cuenta con palabras', async () => {
    fakeCaches().failOnQuota(5);
    fetchMock.mockResolvedValueOnce(fileResponse(100));

    const error = await download('manual', URL_PDF).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MediaDownloadError);
    expect((error as Error).message).toMatch(/no queda espacio/i);
  });
});

describe('media-cache · bordes', () => {
  it('dos descargas del mismo id disparan una sola petición', async () => {
    fetchMock.mockResolvedValue(fileResponse(128));

    const [a, b] = await Promise.all([download('manual', URL_PDF), download('manual', URL_PDF)]);

    expect(a).toBe(URL_PDF);
    expect(b).toBe(URL_PDF);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rechaza una URL que no es de contenido, sin tocar la red', async () => {
    await expect(download('x', 'http://localhost:3000/api/posts')).rejects.toThrow(
      MediaDownloadError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un error del servidor se cuenta con palabras, no con un status suelto', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(download('manual', URL_PDF)).rejects.toThrow(/404/);
    await expect(isDownloaded('manual')).resolves.toBe(false);
  });

  it('remove borra los bytes y el registro', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse(64));
    await download('manual', URL_PDF);

    await remove('manual');

    await expect(isDownloaded('manual')).resolves.toBe(false);
    await expect(listDownloaded()).resolves.toHaveLength(0);
    const cache = await fakeCaches().open(MEDIA_CACHE);
    await expect(cache.match(URL_PDF)).resolves.toBeUndefined();
  });

  it('borrar algo que no existe no es un error', async () => {
    await expect(remove('fantasma')).resolves.toBeUndefined();
  });

  // Firefox en modo privado no trae Cache Storage. El módulo tiene que decir
  // "no hay nada guardado", nunca reventar la pantalla que lo llamó.
  describe('sin Cache Storage en el navegador', () => {
    beforeEach(() => uninstallCacheStorage());
    afterEach(() => installFakeCacheStorage());

    it('lo declara y degrada en vez de lanzar', async () => {
      expect(isCacheStorageAvailable()).toBe(false);
      await expect(isDownloaded('manual')).resolves.toBe(false);
      await expect(getLocalUrl('manual')).resolves.toBeNull();
      await expect(needsUpdate('manual', '1')).resolves.toBe(true);
      await expect(totalDownloadedBytes()).resolves.toBe(0);
    });

    it('descargar avisa con un error tipado', async () => {
      await expect(download('manual', URL_PDF)).rejects.toThrow(MediaDownloadError);
    });
  });
});

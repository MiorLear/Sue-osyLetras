import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaItem } from '@explorarte/shared';

import { clearToasts, toast } from '@/components/toast-store';
import { clearEverything } from '@/lib/idb';
import { download } from '@/lib/media-cache';
import { canShareFiles, openFile, saveFile, shareFile } from '@/lib/open-file';
import { installFakeCacheStorage } from '@/test/cache-storage';

// Abrir, guardar y compartir en un navegador. Lo que se prueba es sobre todo lo
// que en RN resolvía el sistema operativo y aquí hay que hacer a mano: revocar
// el object URL, no ofrecer compartir donde no funciona, y no dejar nunca a la
// usuaria sin respuesta (BUG-02).

const ITEM: MediaItem = {
  id: 'manual',
  title: 'Manual ExplorArte',
  url: 'http://localhost:3000/media/tools/manual-explorarte.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
};

let fetchMock: ReturnType<typeof vi.fn>;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  installFakeCacheStorage();
  await clearEverything();
  clearToasts();

  fetchMock = vi.fn().mockResolvedValue(
    new Response(new Uint8Array(1024), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Length': '1024' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  createObjectURL = vi.fn(() => 'blob:fake-url');
  revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', Object.assign(globalThis.URL, { createObjectURL, revokeObjectURL }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('saveFile', () => {
  it('descarga si hace falta y guarda con el nombre del archivo', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await expect(saveFile(ITEM, true)).resolves.toBe(true);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });

  // Cada object URL que no se revoca retiene su blob en memoria hasta cerrar la
  // pestaña. Con videos de decenas de megas eso se nota.
  it('revoca el object URL aunque el click falle', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    await expect(saveFile(ITEM, true)).resolves.toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  // El contraste con BUG-02: allí un Alert.alert que en web no existía dejaba a
  // la usuaria mirando una pantalla que no reaccionaba.
  it('sin copia local y sin red avisa en vez de callarse', async () => {
    const notice = vi.spyOn(toast, 'info');

    await expect(saveFile(ITEM, false)).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(notice).toHaveBeenCalledOnce();
    expect(notice.mock.calls[0][0]).toMatch(/conéctate a internet/i);
  });
});

describe('canShareFiles', () => {
  it('es falso sin la API', () => {
    vi.stubGlobal('navigator', { userAgent: 'test' });
    expect(canShareFiles()).toBe(false);
  });

  // navigator.share existe en sitios donde compartir FICHEROS no: la única
  // comprobación válida es canShare({ files }).
  it('es falso cuando el navegador comparte texto pero no ficheros', () => {
    vi.stubGlobal('navigator', {
      share: vi.fn(),
      canShare: vi.fn().mockReturnValue(false),
    });
    expect(canShareFiles()).toBe(false);
  });

  it('es verdadero cuando sí sabe compartir ficheros', () => {
    vi.stubGlobal('navigator', {
      share: vi.fn(),
      canShare: vi.fn().mockReturnValue(true),
    });
    expect(canShareFiles()).toBe(true);
  });
});

describe('shareFile', () => {
  it('no hace nada donde compartir ficheros no existe', async () => {
    vi.stubGlobal('navigator', { userAgent: 'test' });
    await expect(shareFile(ITEM, true)).resolves.toBe(false);
  });

  it('comparte el archivo cacheado', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: vi.fn().mockReturnValue(true), onLine: true });

    await download(ITEM.id, ITEM.url);
    await expect(shareFile(ITEM, true)).resolves.toBe(true);
    expect(share).toHaveBeenCalledOnce();
  });

  // Cerrar la hoja de compartir es una decisión de la usuaria, no un fallo que
  // merezca un aviso rojo.
  it('cerrar la hoja no se trata como error', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'));
    vi.stubGlobal('navigator', { share, canShare: vi.fn().mockReturnValue(true), onLine: true });

    await download(ITEM.id, ITEM.url);
    await expect(shareFile(ITEM, true)).resolves.toBe(false);
  });
});

describe('openFile', () => {
  it('abre la URL local cuando el archivo está cacheado', async () => {
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal('open', open);

    await download(ITEM.id, ITEM.url);
    await expect(openFile(ITEM, false)).resolves.toBe(true);

    expect(open).toHaveBeenCalledWith(ITEM.url, '_blank', 'noopener,noreferrer');
  });

  it('sin copia y sin red no abre nada y lo dice', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);

    await expect(openFile(ITEM, false)).resolves.toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('avisa si el navegador bloquea la ventana', async () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(null));
    await download(ITEM.id, ITEM.url);
    await expect(openFile(ITEM, true)).resolves.toBe(false);
  });
});

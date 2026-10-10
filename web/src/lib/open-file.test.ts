import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaItem } from '@explorarte/shared';

import { clearToasts, toast } from '@/components/toast-store';
import { clearEverything } from '@/lib/idb';
import { download, mediaVersion } from '@/lib/media-cache';
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
  // Con versión publicada, una copia guardada no se revalida por la red.
  etag: 'v1',
};

/** Deja el archivo guardado en el dispositivo, al día con su versión. */
const saveLocally = () => download(ITEM.id, ITEM.url, { version: mediaVersion(ITEM) });

let fetchMock: ReturnType<typeof vi.fn>;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  installFakeCacheStorage();
  await clearEverything();
  clearToasts();

  fetchMock = vi.fn().mockImplementation(async () =>
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

/** Simula `navigator.userActivation` con el toque vivo o caducado. */
function stubActivation(isActive: boolean) {
  vi.stubGlobal('navigator', { ...navigator, onLine: true, userActivation: { isActive, hasBeenActive: true } });
}

/** La acción del último aviso de éxito, que es como se recupera el toque. */
function lastToastAction(spy: { mock: { calls: unknown[][] } }) {
  const options = spy.mock.calls.at(-1)?.[1] as { action?: { label: string; onClick: () => void } } | undefined;
  return options?.action;
}

describe('saveFile', () => {
  it('con el archivo ya guardado, lo guarda en el mismo toque', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await saveLocally();

    await expect(saveFile(ITEM, true)).resolves.toBe(true);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });

  // El bug del teléfono: bajar el archivo gasta el toque, y un click() sin toque
  // el navegador móvil lo descarta sin abrir el selector de archivos.
  it('si tuvo que descargarlo, pide un toque nuevo en vez de guardar a ciegas', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const success = vi.spyOn(toast, 'success');

    await expect(saveFile(ITEM, true)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(click).not.toHaveBeenCalled();
    const action = lastToastAction(success);
    expect(action?.label).toBe('Guardar');

    action?.onClick();
    expect(click).toHaveBeenCalledOnce();
  });

  it('con navigator.userActivation decide por el estado real del toque', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const success = vi.spyOn(toast, 'success');

    // Descarga rápida: el toque sigue vivo y se guarda directamente.
    stubActivation(true);
    await expect(saveFile(ITEM, true)).resolves.toBe(true);
    expect(click).toHaveBeenCalledOnce();
    expect(success).not.toHaveBeenCalled();

    // Copia local pero toque caducado (p. ej. tras revalidar por la red).
    stubActivation(false);
    await expect(saveFile(ITEM, true)).resolves.toBe(true);
    expect(click).toHaveBeenCalledOnce();
    expect(lastToastAction(success)?.label).toBe('Guardar');
  });

  // Cada object URL que no se revoca retiene su blob en memoria hasta cerrar la
  // pestaña. Con videos de decenas de megas eso se nota.
  it('revoca el object URL aunque el click falle', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    await saveLocally();

    await expect(saveFile(ITEM, true)).resolves.toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  // Safari en iOS lee el blob después del click: revocarlo en el acto anulaba
  // la descarga.
  it('no revoca el object URL hasta dar tiempo a la descarga', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await saveLocally();
    // Timers falsos no: el IndexedDB falso también usa setTimeout y se cuelga.
    const timeout = vi.spyOn(globalThis, 'setTimeout');

    await expect(saveFile(ITEM, true)).resolves.toBe(true);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    const revoke = timeout.mock.calls.find(([, ms]) => ms === 60_000);
    expect(revoke).toBeDefined();
    (revoke?.[0] as () => void)();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  // Con red, "conéctate a internet" mandaba a mirar el wifi por un fallo que
  // era otra cosa.
  it('si la descarga falla con red, dice el motivo real', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const info = vi.spyOn(toast, 'info');
    const error = vi.spyOn(toast, 'error');

    await expect(saveFile(ITEM, true)).resolves.toBe(false);

    expect(info).not.toHaveBeenCalled();
    expect(error.mock.calls[0][0]).toMatch(/403/);
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

    await saveLocally();
    await expect(shareFile(ITEM, true)).resolves.toBe(true);
    expect(share).toHaveBeenCalledOnce();
  });

  // Cerrar la hoja de compartir es una decisión de la usuaria, no un fallo que
  // merezca un aviso rojo.
  it('cerrar la hoja no se trata como error', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'));
    vi.stubGlobal('navigator', { share, canShare: vi.fn().mockReturnValue(true), onLine: true });

    await saveLocally();
    await expect(shareFile(ITEM, true)).resolves.toBe(false);
  });

  // share() sin un toque reciente lanza NotAllowedError: tras bajar el archivo
  // se pide el toque otra vez, igual que al guardar.
  it('si tuvo que descargarlo, ofrece compartir con un toque nuevo', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: vi.fn().mockReturnValue(true), onLine: true });
    const success = vi.spyOn(toast, 'success');

    await expect(shareFile(ITEM, true)).resolves.toBe(true);
    expect(share).not.toHaveBeenCalled();

    const action = lastToastAction(success);
    expect(action?.label).toBe('Compartir');
    action?.onClick();
    expect(share).toHaveBeenCalledOnce();
  });
});

describe('openFile', () => {
  it('abre la URL local cuando el archivo está cacheado', async () => {
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal('open', open);

    await saveLocally();
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
    await saveLocally();
    await expect(openFile(ITEM, true)).resolves.toBe(false);
  });
});

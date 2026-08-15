import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaItem } from '@explorarte/shared';

import { MediaViewer } from '@/components/MediaViewer';
import { clearEverything } from '@/lib/idb';
import { download } from '@/lib/media-cache';
import { installFakeCacheStorage } from '@/test/cache-storage';

// El visor in-app. Sustituye a VideoModal, que solo sabía de video y solo
// online. Lo que se comprueba: que cada tipo se muestre con su elemento, que el
// PDF no intente renderizarse (decisión de PWA-2.9), y que sin nada que mostrar
// se explique en vez de dejar un hueco negro.
//
// La conectividad se simula sustituyendo el hook: useIsOnline no se fía de
// navigator.onLine —miente en un portal cautivo— y sondea con fetch, que aquí
// competiría con las respuestas simuladas.
let online = true;
vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => online,
}));

const base = {
  id: 'x',
  title: 'Archivo',
  url: 'http://localhost:3000/media/tools/x.bin',
  sizeBytes: 512,
};

function item(mimeType: string, id = 'x'): MediaItem {
  return { ...base, id, mimeType, url: `http://localhost:3000/media/tools/${id}.bin` };
}

function fileResponse(type: string): Response {
  return new Response(new Uint8Array(512), {
    status: 200,
    headers: { 'Content-Type': type, 'Content-Length': '512' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  installFakeCacheStorage();
  await clearEverything();
  online = true;
  fetchMock = vi.fn().mockResolvedValue(fileResponse('application/octet-stream'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('<MediaViewer />', () => {
  it('el video se reproduce dentro de la app', async () => {
    const { container } = render(<MediaViewer item={item('video/mp4', 'clip')} onClose={() => {}} />);
    await waitFor(() => expect(container.querySelector('video')).toBeTruthy());
  });

  it('el audio también', async () => {
    const { container } = render(<MediaViewer item={item('audio/mpeg', 'pista')} onClose={() => {}} />);
    await waitFor(() => expect(container.querySelector('audio')).toBeTruthy());
  });

  it('la imagen se muestra con su título como texto alternativo', async () => {
    render(<MediaViewer item={{ ...item('image/png', 'foto'), title: 'Mural del aula' }} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByAltText('Mural del aula')).toBeTruthy());
  });

  // iOS no pinta un PDF dentro de un iframe y empaquetar pdf.js costaría más
  // que todo el bundle actual, así que se ofrece abrirlo en una pestaña.
  it('el PDF ofrece abrirlo, no intenta renderizarlo', async () => {
    const { container } = render(<MediaViewer item={item('application/pdf', 'doc')} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir' })).toBeTruthy());
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('embed')).toBeNull();
  });

  it('guardar está siempre; compartir solo donde funciona', async () => {
    render(<MediaViewer item={item('application/pdf', 'doc')} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /guardar/i })).toBeTruthy());
    expect(screen.queryByRole('button', { name: /compartir/i })).toBeNull();
  });

  it('con soporte de compartir, el botón aparece', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'test',
      share: vi.fn(),
      canShare: vi.fn().mockReturnValue(true),
    });
    render(<MediaViewer item={item('application/pdf', 'doc')} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /compartir/i })).toBeTruthy());
  });

  // El mismo tono que ContentState usa para offline-empty: no es un fallo, es
  // que esta pantalla no se ha visitado con red.
  it('sin conexión y sin copia local lo explica, no muestra un hueco', async () => {
    online = false;
    const { container } = render(<MediaViewer item={item('video/mp4', 'clip')} onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText(/todavía no está guardado en este dispositivo/i)).toBeTruthy(),
    );
    expect(container.querySelector('video')).toBeNull();
  });

  it('con copia local reproduce aunque no haya red', async () => {
    fetchMock.mockResolvedValueOnce(fileResponse('video/mp4'));
    const video = item('video/mp4', 'clip');
    await download(video.id, video.url);

    online = false;
    const { container } = render(<MediaViewer item={video} onClose={() => {}} />);

    await waitFor(() => expect(container.querySelector('video')).toBeTruthy());
    // Reproduce por la URL canónica, que es la que sirve el service worker:
    // un blob: rompería el adelantado del video.
    expect(container.querySelector('video')?.getAttribute('src')).toBe(video.url);
  });

  it('se cierra con Escape', async () => {
    const onClose = vi.fn();
    render(<MediaViewer item={item('application/pdf', 'doc')} onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

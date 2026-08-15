import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaItem } from '@explorarte/shared';

import { DownloadableMediaItem, MediaList } from '@/components/DownloadableMediaItem';
import { clearToasts, toast } from '@/components/toast-store';
import { clearEverything } from '@/lib/idb';
import { download } from '@/lib/media-cache';
import { installFakeCacheStorage } from '@/test/cache-storage';

// La fila que hace visible la caché de medios. Lo que importa es que los tres
// estados que pide el ticket se distingan de verdad, y que descargar siga
// siendo una decisión de la usuaria y no un efecto de abrir la pantalla
// (SCALE-03: son megabytes del plan de datos de una docente).
//
// La conectividad se simula sustituyendo el hook y no `navigator.onLine`:
// useIsOnline no se fía de esa bandera —miente en un portal cautivo— y hace su
// propio sondeo con fetch, que aquí competiría con las respuestas simuladas de
// la descarga. Ese sondeo ya tiene sus 12 tests en useNetworkStatus.test.ts.
let online = true;
vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => online,
}));

const PDF: MediaItem = {
  id: 'manual',
  title: 'Manual ExplorArte',
  url: 'http://localhost:3000/media/tools/manual.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
};

function pdfResponse(bytes = 2048): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(bytes) },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  installFakeCacheStorage();
  await clearEverything();
  clearToasts();
  online = true;
  fetchMock = vi.fn().mockResolvedValue(pdfResponse());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('<DownloadableMediaItem />', () => {
  it('un archivo nuevo se ofrece para descargar, sin descargarlo solo', async () => {
    render(<DownloadableMediaItem item={PDF} />);

    await waitFor(() => expect(screen.getByText('Descargar')).toBeTruthy());
    expect(screen.getByText('Manual ExplorArte')).toBeTruthy();
    // Lo importante: renderizar la fila no gasta datos.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('descarga al pulsar y queda disponible sin conexión', async () => {
    render(<DownloadableMediaItem item={PDF} />);
    await waitFor(() => expect(screen.getByText('Descargar')).toBeTruthy());

    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => expect(screen.getByText(/disponible sin conexión/i)).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByText('Abrir')).toBeTruthy();
  });

  it('un archivo ya descargado se abre sin tocar la red', async () => {
    await download(PDF.id, PDF.url);
    fetchMock.mockClear();

    render(<DownloadableMediaItem item={PDF} />);

    await waitFor(() => expect(screen.getByText('Abrir')).toBeTruthy());
    await act(async () => {
      screen.getByRole('button').click();
    });

    // Se abrió el visor.
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin conexión lo explica en vez de fallar en silencio', async () => {
    online = false;
    const notice = vi.spyOn(toast, 'info');

    render(<DownloadableMediaItem item={PDF} />);
    await waitFor(() => expect(screen.getByText('Descargar')).toBeTruthy());

    await act(async () => {
      screen.getByRole('button').click();
    });

    expect(notice).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un fallo de descarga se cuenta con su propio mensaje', async () => {
    const error = vi.spyOn(toast, 'error');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

    render(<DownloadableMediaItem item={PDF} />);
    await waitFor(() => expect(screen.getByText('Descargar')).toBeTruthy());

    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(error.mock.calls[0][0]).toMatch(/500/);
    // Y la fila vuelve a ofrecer la descarga, no se queda colgada.
    await waitFor(() => expect(screen.getByText('Descargar')).toBeTruthy());
  });
});

describe('<MediaList />', () => {
  it('no dibuja contenedor cuando no hay archivos', () => {
    const { container } = render(<MediaList items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('pinta una fila por archivo', async () => {
    render(<MediaList items={[PDF, { ...PDF, id: 'guia', title: 'Guía de aula' }]} />);
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(2));
    expect(screen.getByText('Guía de aula')).toBeTruthy();
  });
});

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaItem } from '@explorarte/shared';

import { DownloadableMediaItem, MediaList } from '@/components/DownloadableMediaItem';
import { clearToasts, toast } from '@/components/toast-store';
import { MediaDownloadError } from '@/lib/media-cache';

// Lo que se prueba aquí es lo que DECIDE el componente: los tres estados que
// pide el ticket, y que descargar siga siendo una acción de la usuaria y no un
// efecto de abrir la pantalla (SCALE-03: son megabytes de su plan de datos).
//
// media-cache va mockeado a propósito. La primera versión de este archivo
// llamaba al módulo de verdad, que encadena fetch, Cache Storage e IndexedDB;
// esos tres compartían estado entre tests y el resultado era un fallo
// intermitente —uno de cada tres— en el test del error de descarga. El camino
// real ya está cubierto, y de forma determinista, en media-cache.test.ts: aquí
// solo hace falta poder decir "la descarga falla" y ver qué hace la fila.
const media = vi.hoisted(() => ({
  isDownloaded: vi.fn(async () => false),
  download: vi.fn(async () => 'http://localhost:3000/media/tools/manual.pdf'),
}));

vi.mock('@/lib/media-cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media-cache')>()),
  isDownloaded: media.isDownloaded,
  download: media.download,
}));

// La conectividad también se sustituye: useIsOnline no se fía de
// navigator.onLine —miente en un portal cautivo— y hace su propio sondeo de red.
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

beforeEach(() => {
  clearToasts();
  online = true;
  media.isDownloaded.mockResolvedValue(false);
  media.download.mockResolvedValue(PDF.url);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('<DownloadableMediaItem />', () => {
  it('un archivo nuevo se ofrece para descargar, sin descargarlo solo', async () => {
    render(<DownloadableMediaItem item={PDF} />);

    await waitFor(() => expect(screen.getByText('Descargar')).toBeTruthy());
    expect(screen.getByText('Manual ExplorArte')).toBeTruthy();
    // Lo que más importa del ticket: renderizar la fila no gasta datos.
    expect(media.download).not.toHaveBeenCalled();
  });

  it('descarga al pulsar y queda disponible sin conexión', async () => {
    render(<DownloadableMediaItem item={PDF} />);
    await waitFor(() => expect(screen.getByText('Descargar')).toBeTruthy());

    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => expect(screen.getByText(/disponible sin conexión/i)).toBeTruthy());
    expect(media.download).toHaveBeenCalledOnce();
    expect(screen.getByText('Abrir')).toBeTruthy();
  });

  it('enseña el avance real que reporta la descarga', async () => {
    // La descarga se queda a medias y reporta el 42%.
    let resolveDownload: (url: string) => void = () => {};
    media.download.mockImplementation(async (_id: string, url: string, opts?: unknown) => {
      (opts as { onProgress?: (p: { loaded: number; total: number; ratio: number }) => void })
        ?.onProgress?.({ loaded: 42, total: 100, ratio: 0.42 });
      return new Promise<string>((resolve) => {
        resolveDownload = resolve;
      });
    });

    render(<DownloadableMediaItem item={PDF} />);
    await waitFor(() => expect(screen.getByText('Descargar')).toBeTruthy());
    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => expect(screen.getByText(/42%/)).toBeTruthy());
    await act(async () => {
      resolveDownload(PDF.url);
    });
  });

  it('un archivo ya descargado abre el visor y no vuelve a descargar', async () => {
    media.isDownloaded.mockResolvedValue(true);

    render(<DownloadableMediaItem item={PDF} />);
    await waitFor(() => expect(screen.getByText('Abrir')).toBeTruthy());

    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(media.download).not.toHaveBeenCalled();
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
    expect(media.download).not.toHaveBeenCalled();
  });

  it('un fallo de descarga se cuenta con su propio mensaje', async () => {
    const error = vi.spyOn(toast, 'error');
    media.download.mockRejectedValue(
      new MediaDownloadError('El servidor respondió 500.', PDF.id),
    );

    render(<DownloadableMediaItem item={PDF} />);
    await waitFor(() => expect(screen.getByText('Descargar')).toBeTruthy());

    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(error.mock.calls[0][0]).toMatch(/500/);
    // Y la fila vuelve a ofrecer la descarga, no se queda colgada en "Descargando".
    expect(screen.getByText('Descargar')).toBeTruthy();
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

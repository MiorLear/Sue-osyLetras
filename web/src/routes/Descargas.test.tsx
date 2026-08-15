import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Descargas from '@/routes/Descargas';
import { toast } from '@/components/toast-store';
import * as confirmStore from '@/components/confirm-store';

// La pantalla que le da a la docente control sobre lo que ocupa su teléfono.
// Los módulos de almacenamiento van mockeados: aquí se prueba lo que decide la
// pantalla, y el comportamiento real de cada uno ya tiene sus propios tests.

const media = vi.hoisted(() => ({
  listDownloaded: vi.fn<() => Promise<{ id: string; sizeBytes: number; mimeType?: string }[]>>(),
  totalDownloadedBytes: vi.fn<() => Promise<number>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
}));
vi.mock('@/lib/media-cache', () => media);

const sync = vi.hoisted(() => ({
  collectMediaItems: vi.fn<() => Promise<{ id: string; title: string; sizeBytes: number }[]>>(),
  syncAllContent: vi.fn(),
}));
vi.mock('@/lib/content-sync', () => sync);

let online = true;
vi.mock('@/lib/useNetworkStatus', () => ({ useIsOnline: () => online }));

const storage = vi.hoisted(() => ({
  storageUsage: vi.fn(),
  lastPersistOutcome: vi.fn(),
}));
vi.mock('@/lib/storage-persist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage-persist')>()),
  storageUsage: storage.storageUsage,
  lastPersistOutcome: storage.lastPersistOutcome,
}));

function view() {
  return render(
    <MemoryRouter>
      <Descargas />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  online = true;
  media.listDownloaded.mockResolvedValue([
    { id: 'manual', sizeBytes: 2 * 1024 * 1024, mimeType: 'application/pdf' },
  ]);
  media.totalDownloadedBytes.mockResolvedValue(2 * 1024 * 1024);
  media.remove.mockResolvedValue(undefined);
  sync.collectMediaItems.mockResolvedValue([
    { id: 'manual', title: 'Manual ExplorArte', sizeBytes: 2 * 1024 * 1024 },
  ]);
  sync.syncAllContent.mockResolvedValue({ failures: [], downloaded: [], pruned: [] });
  storage.storageUsage.mockResolvedValue({
    usage: 2 * 1024 * 1024,
    quota: 100 * 1024 * 1024,
    supported: true,
  });
  storage.lastPersistOutcome.mockResolvedValue({ granted: true, supported: true, at: 0 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('<Descargas />', () => {
  it('muestra el total y la cuota del navegador', async () => {
    const { container } = view();

    // Por el total se pregunta por su sitio y no por su texto: el único archivo
    // de la lista pesa lo mismo, así que "2.0 MB" aparece dos veces.
    await waitFor(() =>
      expect(container.querySelector('.storage-card__total')?.textContent).toBe('2.0 MB'),
    );
    expect(screen.getByText(/de 100\.0 MB/)).toBeTruthy();
    expect(screen.getByText('1 archivo guardado')).toBeTruthy();
  });

  // El índice guarda ids; el título vive en el contenido. Sin el cruce, la
  // lista enseñaría uuids.
  it('cruza el índice con el contenido para poder decir el título', async () => {
    view();
    await waitFor(() => expect(screen.getByText('Manual ExplorArte')).toBeTruthy());
  });

  it('degrada cuando el navegador no dice cuánto espacio queda', async () => {
    storage.storageUsage.mockResolvedValue({ supported: false });
    view();
    await waitFor(() => expect(screen.getByText(/no dice cuánto espacio queda/i)).toBeTruthy());
  });

  it('borrar pide confirmación antes de tocar nada', async () => {
    const confirm = vi.spyOn(confirmStore, 'confirmDialog').mockResolvedValue(false);
    view();
    await waitFor(() => expect(screen.getByText('Manual ExplorArte')).toBeTruthy());

    await act(async () => {
      screen.getByRole('button', { name: /borrar manual/i }).click();
    });

    expect(confirm).toHaveBeenCalledOnce();
    expect(media.remove).not.toHaveBeenCalled();
  });

  it('confirmado, borra y refresca', async () => {
    vi.spyOn(confirmStore, 'confirmDialog').mockResolvedValue(true);
    view();
    await waitFor(() => expect(screen.getByText('Manual ExplorArte')).toBeTruthy());

    await act(async () => {
      screen.getByRole('button', { name: /borrar manual/i }).click();
    });

    await waitFor(() => expect(media.remove).toHaveBeenCalledExactlyOnceWith('manual'));
  });

  // Que el navegador desaloje a mitad de la descarga es peor que no empezarla:
  // se pierde también lo que ya había guardado.
  it('se niega a descargar todo si no cabe, y dice las cifras', async () => {
    storage.storageUsage.mockResolvedValue({
      usage: 0,
      quota: 1 * 1024 * 1024,
      supported: true,
    });
    sync.collectMediaItems.mockResolvedValue([
      { id: 'video', title: 'Clase', sizeBytes: 50 * 1024 * 1024 },
    ]);
    const error = vi.spyOn(toast, 'error');

    view();
    await waitFor(() => expect(screen.getByText(/descargar todo/i)).toBeTruthy());
    await act(async () => {
      screen.getByRole('button', { name: /descargar todo/i }).click();
    });

    expect(sync.syncAllContent).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toMatch(/50\.0 MB/);
  });

  it('si cabe, descarga todo', async () => {
    view();
    await waitFor(() => expect(screen.getByText(/descargar todo/i)).toBeTruthy());

    await act(async () => {
      screen.getByRole('button', { name: /descargar todo/i }).click();
    });

    await waitFor(() => expect(sync.syncAllContent).toHaveBeenCalledOnce());
  });

  it('sin conexión lo dice en vez de intentarlo', async () => {
    online = false;
    const notice = vi.spyOn(toast, 'info');

    view();
    await waitFor(() => expect(screen.getByText(/descargar todo/i)).toBeTruthy());
    await act(async () => {
      screen.getByRole('button', { name: /descargar todo/i }).click();
    });

    expect(notice).toHaveBeenCalledOnce();
    expect(sync.syncAllContent).not.toHaveBeenCalled();
  });

  it('avisa de los archivos que no se pudieron bajar, sin dar la pasada por buena', async () => {
    sync.syncAllContent.mockResolvedValue({
      failures: [{ id: 'x', reason: 'roto' }],
      downloaded: [],
      pruned: [],
    });
    const error = vi.spyOn(toast, 'error');

    view();
    await waitFor(() => expect(screen.getByText(/descargar todo/i)).toBeTruthy());
    await act(async () => {
      screen.getByRole('button', { name: /descargar todo/i }).click();
    });

    await waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(error.mock.calls[0][0]).toMatch(/no se pudo descargar/i);
  });

  it('sin nada guardado explica cómo empezar', async () => {
    media.listDownloaded.mockResolvedValue([]);
    media.totalDownloadedBytes.mockResolvedValue(0);

    view();
    await waitFor(() => expect(screen.getByText(/todavía no has guardado nada/i)).toBeTruthy());
  });

  // PWA-2.13: donde se mira el espacio es donde toca decir si el navegador
  // puede borrarlo sin avisar.
  it('dice si el navegador puede borrar el contenido', async () => {
    storage.lastPersistOutcome.mockResolvedValue({ granted: false, supported: false, at: 0 });
    view();
    await waitFor(() => expect(screen.getByText(/puede borrar el contenido/i)).toBeTruthy());
    expect(screen.getByText('Instala la app')).toBeTruthy();
  });
});

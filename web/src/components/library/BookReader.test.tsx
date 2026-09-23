import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ToolBook } from '@explorarte/shared';

// pdf.js y StPageFlip necesitan canvas y layout de verdad, que jsdom no tiene.
// Se sustituyen por dobles que registran lo que se les pide: lo que se prueba
// aquí es el cableado del lector (carga, contador, botones, memoria de página,
// movimiento reducido), no el dibujo.

const flips = vi.hoisted(() => [] as FakeFlip[]);
interface FakeFlip {
  settings: Record<string, unknown>;
  handlers: Record<string, (e: { data: unknown }) => void>;
  flipNext: ReturnType<typeof vi.fn>;
  flipPrev: ReturnType<typeof vi.fn>;
  turnToPage: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

vi.mock('page-flip', () => ({
  PageFlip: class {
    settings: Record<string, unknown>;
    handlers: Record<string, (e: { data: unknown }) => void> = {};
    flipNext = vi.fn();
    flipPrev = vi.fn();
    turnToPage = vi.fn();
    destroy = vi.fn();
    constructor(_el: HTMLElement, settings: Record<string, unknown>) {
      this.settings = settings;
      flips.push(this as unknown as FakeFlip);
    }
    loadFromHTML() {}
    on(event: string, cb: (e: { data: unknown }) => void) {
      this.handlers[event] = cb;
      return this;
    }
    getCurrentPageIndex() {
      return 0;
    }
    getOrientation() {
      return 'portrait';
    }
  },
}));

const pdf = vi.hoisted(() => ({
  openPdf: vi.fn(),
  closePdf: vi.fn(async () => undefined),
  firstPageAspect: vi.fn(async () => 0.7),
  renderPage: vi.fn(async () => undefined),
}));
vi.mock('@/lib/pdf', () => pdf);

const cache = vi.hoisted(() => ({
  getLocalBlob: vi.fn(),
  needsUpdate: vi.fn(async () => false),
  download: vi.fn(),
  isCacheStorageAvailable: vi.fn(() => true),
  mediaVersion: vi.fn(() => undefined),
}));
vi.mock('@/lib/media-cache', async (orig) => ({ ...(await orig<object>()), ...cache }));

const files = vi.hoisted(() => ({
  saveFile: vi.fn(async () => true),
  openFile: vi.fn(async () => true),
  shareFile: vi.fn(async () => true),
  canShareFiles: vi.fn(() => true),
  reportDownloadError: vi.fn(),
}));
vi.mock('@/lib/open-file', () => files);

let online = true;
vi.mock('@/lib/useNetworkStatus', () => ({ useIsOnline: () => online }));

import BookReader from './BookReader';

const BOOK: ToolBook = {
  id: 'manual',
  title: 'Manual ExplorArte',
  author: 'Sueños y Letras',
  file: { id: 'f1', title: 'manual.pdf', url: 'https://explorarte.app/media/tools/f1.pdf', mimeType: 'application/pdf', sizeBytes: 10 },
  cover: null,
  autoCover: null,
};

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const view = () => render(<BookReader book={BOOK} onClose={vi.fn()} />);

beforeEach(() => {
  flips.length = 0;
  vi.clearAllMocks();
  online = true;
  localStorage.clear();
  setReducedMotion(false);
  cache.getLocalBlob.mockResolvedValue(new Blob(['%PDF-1.7']));
  pdf.openPdf.mockResolvedValue({ numPages: 5 });
});

afterEach(cleanup);

describe('<BookReader />', () => {
  it('abre el PDF guardado y cuenta las páginas', async () => {
    view();
    expect(await screen.findByText('Página 1 de 5')).toBeTruthy();
    expect(pdf.openPdf).toHaveBeenCalledTimes(1);
    // Ya estaba en el dispositivo: no se vuelve a bajar.
    expect(cache.download).not.toHaveBeenCalled();
    // Se pinta la abierta y las de alrededor, no el libro entero.
    await waitFor(() => expect(pdf.renderPage).toHaveBeenCalled());
    const pagesPainted = pdf.renderPage.mock.calls.map((c) => (c as unknown[])[1]);
    expect(pagesPainted[0]).toBe(1);
  });

  it('los botones pasan de página y el contador sigue al libro', async () => {
    view();
    await screen.findByText('Página 1 de 5');
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(flips[0].flipNext).toHaveBeenCalled();
    act(() => flips[0].handlers.flip({ data: 2 }));
    expect(screen.getByText('Página 3 de 5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(flips[0].flipPrev).toHaveBeenCalled();
  });

  it('recuerda en qué página se quedó', async () => {
    const first = view();
    await screen.findByText('Página 1 de 5');
    act(() => flips[0].handlers.flip({ data: 3 }));
    first.unmount();

    view();
    expect(await screen.findByText('Página 4 de 5')).toBeTruthy();
    expect(flips[1].settings.startPage).toBe(3);
  });

  it('Descargar y Abrir en otra app usan el archivo del libro', async () => {
    view();
    await screen.findByText('Página 1 de 5');
    fireEvent.click(screen.getByRole('button', { name: /Descargar/ }));
    await waitFor(() => expect(files.saveFile).toHaveBeenCalledWith(BOOK.file, true));
    fireEvent.click(screen.getByRole('button', { name: /Abrir en otra app/ }));
    await waitFor(() => expect(files.openFile).toHaveBeenCalledWith(BOOK.file, true));
    fireEvent.click(screen.getByRole('button', { name: /Compartir/ }));
    await waitFor(() => expect(files.shareFile).toHaveBeenCalledWith(BOOK.file, true));
  });

  it('sin conexión y sin copia guardada lo dice, en vez de quedarse en blanco', async () => {
    online = false;
    cache.getLocalBlob.mockResolvedValue(null);
    view();
    expect(await screen.findByText(/Sin conexión, y este libro todavía no está guardado/)).toBeTruthy();
    expect(pdf.openPdf).not.toHaveBeenCalled();
  });

  it('con movimiento reducido la página cambia sin animación', async () => {
    setReducedMotion(true);
    view();
    await screen.findByText('Página 1 de 5');
    expect(flips[0].settings.flippingTime).toBe(1);
    expect(flips[0].settings.drawShadow).toBe(false);
  });

  it('un PDF que no se puede abrir ofrece las otras salidas', async () => {
    pdf.openPdf.mockRejectedValue(new Error('corrupto'));
    view();
    expect(await screen.findByText(/No se pudo abrir este PDF/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Descargar/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Abrir en otra app/ })).toBeTruthy();
  });
});

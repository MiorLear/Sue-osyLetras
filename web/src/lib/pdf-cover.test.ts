import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaItem } from '@explorarte/shared';

const api = vi.hoisted(() => ({ media: { upload: vi.fn() } }));
vi.mock('@/lib/api', () => ({ api }));

const pdf = vi.hoisted(() => ({ renderCover: vi.fn() }));
vi.mock('@/lib/pdf', () => pdf);

import { generateAutoCover } from './pdf-cover';

const FILE: MediaItem = {
  id: 'f1',
  title: 'Manual_ExplorArte.pdf',
  url: 'https://explorarte.app/media/tools/f1.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([37, 80, 68, 70]))));
  pdf.renderCover.mockResolvedValue(new Blob(['jpg'], { type: 'image/jpeg' }));
  api.media.upload.mockResolvedValue({ ...FILE, id: 'c1', title: 'portada.jpg', mimeType: 'image/jpeg' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('generateAutoCover', () => {
  it('dibuja la primera página y la sube como portada', async () => {
    const cover = await generateAutoCover(FILE);
    expect(cover.id).toBe('c1');
    expect(api.media.upload).toHaveBeenCalledWith(expect.any(Blob), 'Manual_ExplorArte-portada.jpg', 'tools');
  });

  it('se rinde a tiempo si el PDF nunca llega, en vez de colgar el editor', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    const pending = generateAutoCover(FILE, 5_000);
    const outcome = expect(pending).rejects.toThrow('La portada tardó demasiado.');
    await vi.advanceTimersByTimeAsync(5_000);
    await outcome;
    expect(api.media.upload).not.toHaveBeenCalled();
  });

  it('un PDF que no se puede leer es un error, no una portada vacía', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 403 })));
    await expect(generateAutoCover(FILE)).rejects.toThrow('No se pudo leer el PDF (403).');
    expect(api.media.upload).not.toHaveBeenCalled();
  });
});

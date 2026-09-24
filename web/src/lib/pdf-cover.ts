import type { MediaItem } from '@explorarte/shared';

import { api } from '@/lib/api';

// La portada automática de un libro: la primera página del PDF, dibujada en el
// navegador de la administradora y subida como imagen.
//
// Se hace aquí y no en el teléfono de cada docente a propósito: para dibujar un
// estante habría que bajar cada PDF entero (hasta 25 MB) solo por su portada.
// Así las docentes bajan una imagen de unos 60 KB por libro.

/** Cuánto se espera a una portada antes de darla por perdida. */
export const COVER_TIMEOUT_MS = 60_000;

function withTimeout<T>(work: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error('La portada tardó demasiado.'));
    }, ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Descarga el PDF, dibuja su primera página y la sube a `tools`.
 *
 * Siempre termina: con la portada o con un error, a lo sumo en
 * COVER_TIMEOUT_MS. Una promesa colgada aquí dejaba el editor esperando para
 * siempre, y con él los botones de guardar.
 */
export async function generateAutoCover(file: MediaItem, timeoutMs = COVER_TIMEOUT_MS): Promise<MediaItem> {
  const abort = new AbortController();
  return withTimeout(render(file, abort.signal), timeoutMs, () => abort.abort());
}

async function render(file: MediaItem, signal: AbortSignal): Promise<MediaItem> {
  const res = await fetch(file.url, { signal });
  if (!res.ok) throw new Error(`No se pudo leer el PDF (${res.status}).`);
  const data = await res.arrayBuffer();
  // pdf.js solo se carga cuando de verdad hace falta una portada.
  const { renderCover } = await import('@/lib/pdf');
  const jpeg = await renderCover(data);
  if (signal.aborted) throw new Error('La portada tardó demasiado.');
  const base = (file.title || 'libro').replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 80);
  return api.media.upload(jpeg, `${base}-portada.jpg`, 'tools');
}

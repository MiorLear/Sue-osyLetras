import type { MediaItem } from '@explorarte/shared';

import { api } from '@/lib/api';

// La portada automática de un libro: la primera página del PDF, dibujada en el
// navegador de la administradora y subida como imagen.
//
// Se hace aquí y no en el teléfono de cada docente a propósito: para dibujar un
// estante habría que bajar cada PDF entero (hasta 25 MB) solo por su portada.
// Así las docentes bajan una imagen de unos 60 KB por libro.

/** Descarga el PDF, dibuja su primera página y la sube a `tools`. */
export async function generateAutoCover(file: MediaItem): Promise<MediaItem> {
  const res = await fetch(file.url);
  if (!res.ok) throw new Error(`No se pudo leer el PDF (${res.status}).`);
  const data = await res.arrayBuffer();
  // pdf.js solo se carga cuando de verdad hace falta una portada.
  const { renderCover } = await import('@/lib/pdf');
  const jpeg = await renderCover(data);
  const base = (file.title || 'libro').replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 80);
  return api.media.upload(jpeg, `${base}-portada.jpg`, 'tools');
}

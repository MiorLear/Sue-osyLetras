import type { MediaItem, ToolBook } from '@explorarte/shared';

/** Solo los PDF se leen dentro de la app; el resto se descarga o se abre fuera. */
export function isPdf(file: Pick<MediaItem, 'mimeType' | 'url' | 'title'>): boolean {
  // El tipo lo decide el servidor olfateando los bytes: si está, manda. El
  // nombre solo cuenta cuando falta, y es fácil que mienta.
  if (file.mimeType) return file.mimeType === 'application/pdf';
  return /\.pdf(?:$|[?#])/i.test(file.url) || /\.pdf$/i.test(file.title);
}

/** La portada que se ve: la propia, si no la primera página, si no ninguna. */
export function coverOf(book: ToolBook): MediaItem | null {
  return book.cover ?? book.autoCover ?? null;
}

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOC',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLS',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPT',
};

/** La etiqueta corta del tipo de archivo que va en el lomo de la portada genérica. */
export function fileBadge(file: MediaItem): string {
  const known = EXT_BY_MIME[file.mimeType];
  if (known) return known;
  const ext = /\.([a-z0-9]{2,4})(?:$|[?#])/i.exec(file.url)?.[1] ?? /\.([a-z0-9]{2,4})$/i.exec(file.title)?.[1];
  return ext ? ext.toUpperCase() : 'DOC';
}

// Colores de tela de encuadernación, dentro de la paleta de la app.
const CLOTHS = [
  ['#2fa7a0', '#1e7e78'],
  ['#d98763', '#c5704e'],
  ['#c98a3e', '#a86f2c'],
  ['#5c8a4f', '#46703b'],
  ['#6b7fb5', '#4f6296'],
  ['#b0607a', '#8f4760'],
] as const;

/** El mismo libro sale siempre del mismo color, pase lo que pase con el orden. */
export function clothFor(id: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return CLOTHS[Math.abs(h) % CLOTHS.length];
}

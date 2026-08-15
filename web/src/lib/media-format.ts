import type { IconName } from '@/components/Icon';

// Cómo se presenta un archivo: qué icono le toca y cómo se dice su tamaño.
// Vive fuera de los componentes para que el visor y la fila de descarga usen
// exactamente el mismo criterio, y porque un archivo de componente que además
// exporta funciones rompe el fast refresh.

/** Familia de un archivo a partir de su mime type. */
export function mediaKind(mimeType: string | undefined): 'video' | 'audio' | 'image' | 'file' {
  if (!mimeType) return 'file';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  return 'file';
}

/** Icono para un archivo. Lo desconocido es un documento, no un hueco. */
export function iconFor(mimeType: string | undefined): IconName {
  switch (mediaKind(mimeType)) {
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    case 'audio':
      return 'volume';
    default:
      return 'file-text';
  }
}

/** Tamaño legible. Los medios van de kilobytes a decenas de megas. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

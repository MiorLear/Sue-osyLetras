import type { MediaItem } from '@explorarte/shared';

import { toast } from '@/components/toast-store';
import { MediaDownloadError, download, getLocalBlob, getLocalUrl } from '@/lib/media-cache';

// Abrir, guardar y compartir un archivo en un navegador.
//
// Es el puerto de src/lib/open-file.ts, que en RN lanza un ACTION_VIEW de
// Android con expo-intent-launcher y cae en expo-sharing. Ninguna de las dos
// existe aquí, y las equivalencias del navegador tienen sus propias trampas:
//
//   - El atributo `download` de un <a> SE IGNORA entre orígenes. Los medios
//     viven en Cloud Storage o en el propio dominio según el entorno, así que
//     guardar tiene que pasar por un blob URL para funcionar en los dos.
//   - `navigator.share` existe en sitios donde compartir FICHEROS no. La única
//     comprobación válida es `canShare({ files })`.
//   - Cerrar la hoja de compartir lanza AbortError. No es un fallo y no puede
//     acabar en un aviso de error.
//
// Nada de esto falla en silencio: el criterio de PWA-2.9 lo pide explícitamente,
// en contraste con BUG-02, donde un Alert.alert que en web no existía dejaba a
// la usuaria mirando una pantalla que no reaccionaba.

/** Nombre con el que se guarda el archivo. */
function fileNameFor(item: MediaItem): string {
  try {
    const last = new URL(item.url).pathname.split('/').pop();
    if (last) return decodeURIComponent(last);
  } catch {
    /* URL rota: se usa el título */
  }
  return item.title || 'archivo';
}

/**
 * Los bytes locales, descargándolos antes si hace falta y se puede.
 * Devuelve null cuando no hay copia y tampoco forma de conseguirla.
 */
async function ensureLocal(item: MediaItem, online: boolean): Promise<Blob | null> {
  const cached = await getLocalBlob(item.id);
  if (cached) return cached;
  if (!online) return null;
  try {
    await download(item.id, item.url, { version: String(item.sizeBytes ?? '') });
  } catch {
    return null;
  }
  return getLocalBlob(item.id);
}

/** El aviso de "esto solo se arregla con internet", en un solo sitio. */
function noticeUnavailable(): void {
  toast.info(
    'Conéctate a internet una vez para descargar este archivo; después podrás abrirlo sin conexión.',
    { title: 'No disponible sin conexión' },
  );
}

/**
 * Guarda el archivo en el dispositivo.
 *
 * Pasa siempre por un blob URL: el atributo `download` de un enlace se ignora
 * cuando el archivo está en otro origen, que es justo el caso de los medios.
 * El object URL se revoca pase lo que pase — cada uno que se olvide retiene su
 * blob en memoria hasta que se cierre la pestaña.
 */
export async function saveFile(item: MediaItem, online: boolean): Promise<boolean> {
  const blob = await ensureLocal(item, online);
  if (!blob) {
    noticeUnavailable();
    return false;
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileNameFor(item);
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  } catch {
    toast.error('No se pudo guardar el archivo. Inténtalo de nuevo.');
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Si este navegador sabe compartir ficheros.
 *
 * `navigator.share` a secas no vale: existe en escritorio y en navegadores que
 * solo comparten texto y URLs, y ahí `share({ files })` lanza. Un botón que no
 * hace nada es peor que no tener botón.
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    const probe = new File([new Blob([''])], 'probe.txt', { type: 'text/plain' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Abre la hoja de compartir del sistema con el archivo. */
export async function shareFile(item: MediaItem, online: boolean): Promise<boolean> {
  if (!canShareFiles()) return false;

  const blob = await ensureLocal(item, online);
  if (!blob) {
    noticeUnavailable();
    return false;
  }

  try {
    const file = new File([blob], fileNameFor(item), {
      type: item.mimeType || blob.type || 'application/octet-stream',
    });
    await navigator.share({ files: [file], title: item.title });
    return true;
  } catch (e) {
    // Cerrar la hoja es una decisión de la usuaria, no un error que avisar.
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    toast.error('No se pudo compartir el archivo.');
    return false;
  }
}

/**
 * Abre el archivo en una pestaña, que es la salida para lo que el visor no
 * sabe mostrar — sobre todo el PDF en iOS, donde Safari no lo renderiza dentro
 * de un iframe (ver el comentario de MediaViewer.tsx).
 *
 * Se abre por la URL canónica cuando hay copia local, para que la responda el
 * service worker y funcione sin conexión.
 */
export async function openFile(item: MediaItem, online: boolean): Promise<boolean> {
  const local = await getLocalUrl(item.id);
  const target = local ?? (online ? item.url : null);

  if (!target) {
    noticeUnavailable();
    return false;
  }

  const opened = window.open(target, '_blank', 'noopener,noreferrer');
  if (!opened) {
    toast.error('El navegador bloqueó la ventana. Permite las ventanas emergentes para abrirlo.');
    return false;
  }
  return true;
}

/** Traduce un fallo de descarga a algo que se le pueda decir a una persona. */
export function reportDownloadError(e: unknown): void {
  if (e instanceof MediaDownloadError) {
    toast.error(e.message);
    return;
  }
  toast.error('No se pudo descargar el archivo. Inténtalo de nuevo.');
}

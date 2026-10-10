import type { MediaItem } from '@explorarte/shared';

import { toast } from '@/components/toast-store';
import {
  MediaDownloadError,
  download,
  getLocalBlob,
  getLocalUrl,
  mediaVersion,
  needsUpdate,
} from '@/lib/media-cache';

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
//   - Guardar y compartir necesitan un toque RECIENTE de la usuaria (activación
//     transitoria, que caduca en segundos). Si antes hay que bajar el archivo,
//     el toque ya caducó al terminar: en el móvil el navegador descarta el
//     guardado sin abrir el selector de archivos ni avisar de nada, y
//     `share()` lanza NotAllowedError. Por eso, cuando el toque se gastó en la
//     descarga, se pide otro con un botón en el aviso. Es el bug de "en el
//     teléfono no se pueden guardar documentos nuevos": los ya guardados sí
//     funcionaban porque leerlos de la caché es instantáneo.
//   - El object URL no se puede revocar justo después de `click()`: Safari en
//     iOS y Firefox leen el blob más tarde y, revocado, la descarga no ocurre.
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

/** Los bytes, y si hubo que bajarlos de la red para tenerlos. */
interface LocalBytes {
  blob: Blob;
  fetched: boolean;
}

/**
 * Los bytes locales, descargándolos antes si hace falta y se puede.
 * Devuelve null —y ya avisó del motivo— cuando no hay forma de conseguirlos.
 */
async function ensureLocal(item: MediaItem, online: boolean): Promise<LocalBytes | null> {
  const cached = await getLocalBlob(item.id);
  if (cached && (!online || !(await needsUpdate(item.id, mediaVersion(item))))) {
    return { blob: cached, fetched: false };
  }
  if (!online) {
    noticeUnavailable();
    return null;
  }
  try {
    await download(item.id, item.url, { version: mediaVersion(item) });
  } catch (e) {
    // Con red, decir "conéctate a internet" mandaría a mirar el wifi cuando lo
    // que falló es otra cosa: se dice lo que pasó.
    reportDownloadError(e);
    return null;
  }
  const blob = await getLocalBlob(item.id);
  if (!blob) {
    toast.error('No se pudo descargar el archivo. Inténtalo de nuevo.');
    return null;
  }
  return { blob, fetched: true };
}

/** El aviso de "esto solo se arregla con internet", en un solo sitio. */
function noticeUnavailable(): void {
  toast.info(
    'Conéctate a internet una vez para descargar este archivo; después podrás abrirlo sin conexión.',
    { title: 'No disponible sin conexión' },
  );
}

/**
 * Si el toque que pidió la acción sigue sirviendo para guardar o compartir.
 *
 * `navigator.userActivation` lo dice exactamente (Chrome 72, Safari 16.4,
 * Firefox 120). Sin esa API se supone que una descarga por la red lo gastó y
 * que leer de la caché no.
 */
function gestureStillActive(fetched: boolean): boolean {
  const activation = typeof navigator === 'undefined' ? undefined : navigator.userActivation;
  if (activation) return activation.isActive;
  return !fetched;
}

/** Ofrece un botón que hace `run` con un toque nuevo, porque el primero caducó. */
function offerWithNewGesture(label: string, run: () => unknown): void {
  toast.success('El archivo ya está descargado en este dispositivo.', {
    title: 'Archivo listo',
    // Lo bastante para leerlo y tocar; el aviso retiene el archivo en memoria
    // mientras esté en pantalla, así que no se queda para siempre.
    duration: 20000,
    action: { label, onClick: () => void run() },
  });
}

/** Cuánto vive el object URL tras pedir la descarga (ver la cabecera). */
const REVOKE_AFTER_MS = 60_000;

/**
 * Pide al navegador que guarde el blob. Tiene que correr dentro del toque.
 *
 * Pasa siempre por un blob URL: el atributo `download` de un enlace se ignora
 * cuando el archivo está en otro origen, que es justo el caso de los medios.
 * El object URL se revoca siempre —cada uno que se olvide retiene su blob en
 * memoria hasta que se cierre la pestaña—, pero con margen si la descarga
 * arrancó.
 */
function triggerSave(blob: Blob, fileName: string): boolean {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    URL.revokeObjectURL(url);
    toast.error('No se pudo guardar el archivo. Inténtalo de nuevo.');
    return false;
  }
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  return true;
}

/** Guarda el archivo en el dispositivo. */
export async function saveFile(item: MediaItem, online: boolean): Promise<boolean> {
  const local = await ensureLocal(item, online);
  if (!local) return false;

  const save = () => triggerSave(local.blob, fileNameFor(item));
  if (gestureStillActive(local.fetched)) return save();
  offerWithNewGesture('Guardar', save);
  return true;
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

  const local = await ensureLocal(item, online);
  if (!local) return false;

  const file = new File([local.blob], fileNameFor(item), {
    type: item.mimeType || local.blob.type || 'application/octet-stream',
  });
  const share = () => openShareSheet(file, item.title);
  if (gestureStillActive(local.fetched)) return share();
  offerWithNewGesture('Compartir', share);
  return true;
}

async function openShareSheet(file: File, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title });
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
  const stale = local && online ? await needsUpdate(item.id, mediaVersion(item)) : false;
  const target = local && !stale ? local : online ? item.url : null;

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

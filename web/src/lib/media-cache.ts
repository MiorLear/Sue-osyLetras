import {
  STORES,
  deleteRecord,
  getAllRecords,
  getRecord,
  isIdbAvailable,
  putRecord,
  type MediaIndexRecord,
} from '@/lib/idb';
import { MEDIA_CACHE, isMediaUrl, isSameOriginMedia } from '@/lib/media-origins';

// Caché de archivos (PDF, video, audio, imágenes) para verlos sin conexión.
// Es el puerto web de src/lib/offlineStorage.ts, con la misma API pública para
// que los llamadores se porten mecánicamente — y es el único módulo del
// subsistema offline que estaba genuinamente atado a la plataforma: el original
// usa la API de clases de expo-file-system, cuya implementación web es un
// console.warn que devuelve undefined.
//
// El sustituto es Cache Storage, no IndexedDB con blobs: guarda objetos
// Response sin inflarlos a base64, se lee igual desde la página y desde el
// worker, y soporta peticiones Range — que es lo que permite adelantar un video
// cacheado sin conexión (PWA-2.8).
//
// El índice (qué hay guardado, cuánto pesa, de cuándo es) vive en el store
// `mediaIndex` de IndexedDB, que a propósito NO está scoped por usuaria: los
// medios son públicos y compartir una descarga entre las docentes de una tablet
// es justo el objetivo.
//
// LA CLAVE ES SIEMPRE LA URL CANÓNICA. Una URL de medios responde 302 hacia
// Cloud Storage con una firma que caduca; guardar bajo la URL final dejaría
// entradas que se invalidan solas y nunca se vuelven a acertar.

/** Error tipado: quien sincroniza decide si sigue con el resto (PWA-2.11). */
export class MediaDownloadError extends Error {
  constructor(
    message: string,
    readonly id: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MediaDownloadError';
  }
}

export interface DownloadProgress {
  /** Bytes recibidos hasta ahora. */
  loaded: number;
  /** Total anunciado por `Content-Length`, o undefined si no vino. */
  total?: number;
  /** 0–1, o undefined cuando no hay total y el progreso es indeterminado. */
  ratio?: number;
}

export interface DownloadOptions {
  /** Versión opaca del llamador (hoy `sizeBytes` del MediaItem). */
  version?: string;
  onProgress?: (p: DownloadProgress) => void;
  signal?: AbortSignal;
}

/** True cuando el navegador trae Cache Storage (Firefox en privado no). */
export function isCacheStorageAvailable(): boolean {
  return typeof caches !== 'undefined';
}

function usable(): boolean {
  return isCacheStorageAvailable() && isIdbAvailable();
}

async function openMediaCache(): Promise<Cache | null> {
  if (!isCacheStorageAvailable()) return null;
  try {
    return await caches.open(MEDIA_CACHE);
  } catch {
    return null;
  }
}

async function readMeta(id: string): Promise<MediaIndexRecord | undefined> {
  if (!isIdbAvailable()) return undefined;
  try {
    return await getRecord<MediaIndexRecord>(STORES.mediaIndex, id);
  } catch {
    return undefined;
  }
}

async function writeMeta(record: MediaIndexRecord): Promise<void> {
  try {
    await putRecord(STORES.mediaIndex, record);
  } catch {
    // El índice es una optimización; los bytes ya están guardados.
  }
}

/** Marca el uso para la evicción LRU. Nunca bloquea la lectura. */
function touch(record: MediaIndexRecord): void {
  void writeMeta({ ...record, lastAccessAt: Date.now() });
}

/**
 * True si el archivo está descargado.
 *
 * Comprueba las dos cosas —registro y bytes— porque el navegador puede vaciar
 * Cache Storage por presión de almacenamiento sin tocar IndexedDB, y entonces
 * el índice miente.
 */
export async function isDownloaded(id: string): Promise<boolean> {
  if (!usable()) return false;
  const meta = await readMeta(id);
  if (!meta) return false;
  const cache = await openMediaCache();
  if (!cache) return false;
  return (await cache.match(meta.url)) !== undefined;
}

/**
 * La URL con la que reproducir o mostrar el archivo sin conexión, o null.
 *
 * Devuelve la URL CANÓNICA, no un `blob:`. Es deliberado: el service worker
 * intercepta esa URL y responde desde la caché, incluidas las peticiones Range,
 * así que `<video>` conserva el adelantado. Un `blob:` lo rompería y además
 * obligaría a mantener object URLs vivos mientras la pantalla exista.
 * Para los bytes en mano, `getLocalBlob`.
 */
export async function getLocalUrl(id: string): Promise<string | null> {
  if (!usable()) return null;
  const meta = await readMeta(id);
  if (!meta) return null;
  const cache = await openMediaCache();
  if (!cache) return null;
  const hit = await cache.match(meta.url);
  if (!hit) return null;
  touch(meta);
  return meta.url;
}

/** Los bytes guardados, para guardar el archivo o compartirlo (PWA-2.9). */
export async function getLocalBlob(id: string): Promise<Blob | null> {
  if (!usable()) return null;
  const meta = await readMeta(id);
  if (!meta) return null;
  const cache = await openMediaCache();
  if (!cache) return null;
  const hit = await cache.match(meta.url);
  if (!hit) return null;
  touch(meta);
  return hit.blob();
}

/**
 * Si la copia local se quedó vieja respecto al servidor.
 *
 * Sin copia, siempre sí. Con copia, cómo se comprueba depende del origen, y no
 * por gusto (BUG-05):
 *
 *   - MISMO ORIGEN (producción, vía el rewrite `/media/**`): GET condicional
 *     con `If-None-Match` / `If-Modified-Since`. Un 304 confirma la copia, un
 *     200 dice que cambió. Es la comprobación de verdad.
 *   - OTRO ORIGEN (Render, las URLs viejas de Supabase): `ETag` no es una
 *     cabecera de respuesta segura para CORS, así que el navegador se la oculta
 *     a JavaScript salvo que el servidor la exponga, y mandar `If-None-Match`
 *     dispara un preflight. Queda `Last-Modified`, que sí es legible, y si
 *     tampoco viene se compara el tamaño — que es exactamente el defecto que
 *     BUG-05 describe: un archivo corregido del mismo tamaño no se detecta.
 *
 * PWA-4.2 (`updatedAt`/`etag` en MediaItem) hace innecesaria la petición por
 * archivo; hasta entonces esto solo toca la red si `remoteVersion` no basta.
 */
export async function needsUpdate(id: string, remoteVersion: string | undefined): Promise<boolean> {
  if (!usable()) return true;
  const meta = await readMeta(id);
  if (!meta) return true;
  if (!(await isDownloaded(id))) return true;

  // El llamador ya sabe que cambió: no hace falta preguntarle al servidor.
  if (remoteVersion !== undefined && meta.version !== remoteVersion) return true;

  // Otro origen, o ningún validador guardado: no hay nada mejor que la versión
  // del llamador, que ya coincidió. Es el hueco que BUG-05 describe y que
  // PWA-4.2 cierra trayendo el validador dentro del propio MediaItem. No se
  // pide nada por red: entre orígenes la condicional dispara un preflight que
  // el bucket no responde, y gastar datos para no aprender nada es peor.
  const validators = isSameOriginMedia(meta.url) ? { etag: meta.etag, lm: meta.lastModified } : {};
  if (!validators.etag && !validators.lm) return false;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

  return revalidate(meta, validators);
}

/** GET condicional. Ante cualquier duda responde "no hace falta actualizar":
 *  una re-descarga innecesaria le cuesta datos móviles a la docente. */
async function revalidate(
  meta: MediaIndexRecord,
  validators: { etag?: string; lm?: string },
): Promise<boolean> {
  const headers = new Headers();
  if (validators.etag) headers.set('If-None-Match', validators.etag);
  if (validators.lm) headers.set('If-Modified-Since', validators.lm);

  try {
    const res = await fetch(meta.url, { headers, method: 'GET' });
    if (res.status === 304) return false;
    if (!res.ok) return false;
    // Un 200 con el mismo validador es un servidor que ignora la condicional:
    // tratarlo como "cambió" re-descargaría el archivo en cada comprobación.
    const etag = res.headers.get('ETag');
    const lastModified = res.headers.get('Last-Modified');
    if (etag) return etag !== meta.etag;
    if (lastModified) return lastModified !== meta.lastModified;
    return true;
  } catch {
    return false;
  }
}

// Descargas en vuelo, por id: dos pantallas pidiendo el mismo PDF a la vez
// deben producir una sola petición.
const inFlight = new Map<string, Promise<string>>();

/**
 * Descarga el archivo y lo guarda. Devuelve la URL local (ver `getLocalUrl`).
 *
 * El cuerpo se lee por streaming en vez de con `.blob()` por dos razones: el
 * progreso se puede ir reportando contra `Content-Length`, y los bytes se
 * cuentan al acumularlos en vez de creerle al servidor — que es lo que pide
 * BUG-12, porque el tamaño anunciado y el real no siempre coinciden y el
 * contador de almacenamiento se iba desviando.
 */
export async function download(id: string, url: string, opts: DownloadOptions = {}): Promise<string> {
  const running = inFlight.get(id);
  if (running) return running;

  const task = doDownload(id, url, opts).finally(() => inFlight.delete(id));
  inFlight.set(id, task);
  return task;
}

async function doDownload(id: string, url: string, opts: DownloadOptions): Promise<string> {
  if (!isCacheStorageAvailable()) {
    throw new MediaDownloadError('Este navegador no puede guardar archivos sin conexión.', id);
  }
  if (!isMediaUrl(url)) {
    throw new MediaDownloadError(`La URL no es de un archivo de contenido: ${url}`, id);
  }

  let response: Response;
  try {
    response = await fetch(url, { signal: opts.signal });
  } catch (e) {
    throw new MediaDownloadError('No se pudo conectar para descargar el archivo.', id, e);
  }
  if (!response.ok) {
    throw new MediaDownloadError(`El servidor respondió ${response.status}.`, id);
  }

  const declared = Number(response.headers.get('Content-Length'));
  const total = Number.isFinite(declared) && declared > 0 ? declared : undefined;
  const body = await readWithProgress(response, total, opts.onProgress);
  const bytes = body.byteLength;

  const mimeType = response.headers.get('Content-Type') ?? undefined;
  const etag = response.headers.get('ETag') ?? undefined;
  const lastModified = response.headers.get('Last-Modified') ?? undefined;

  // Se reenvuelve el cuerpo en vez de guardar la respuesta original: así la
  // entrada queda bajo la URL canónica aunque la petición haya redirigido a una
  // firmada, y con las cabeceras que nos interesan y ninguna más.
  const stored = new Response(body, {
    status: 200,
    headers: {
      'Content-Type': mimeType ?? 'application/octet-stream',
      'Content-Length': String(bytes),
    },
  });

  await putWithEviction(id, url, stored);

  await writeMeta({
    id,
    url,
    // La versión del llamador y los validadores HTTP van en campos distintos:
    // guardarlos juntos compararía un ETag contra un número de bytes en la
    // siguiente comprobación, y el archivo se re-descargaría siempre.
    version: opts.version,
    etag,
    lastModified,
    sizeBytes: bytes,
    mimeType,
    downloadedAt: Date.now(),
    lastAccessAt: Date.now(),
    blobRef: MEDIA_CACHE,
  });

  return url;
}

/**
 * Lee el cuerpo contando bytes de verdad y reportando avance.
 *
 * Devuelve bytes crudos y no un Blob a propósito: no todos los entornos
 * comparten la misma clase Blob —jsdom trae la suya y el `Response` de Node no
 * la reconoce, así que la convertiría a la cadena "[object Blob]"— y una
 * Uint8Array es cuerpo válido en todos.
 */
async function readWithProgress(
  response: Response,
  total: number | undefined,
  onProgress?: (p: DownloadProgress) => void,
): Promise<Uint8Array> {
  // Sin cuerpo legible por trozos (respuestas sin stream) se cae a leerlo
  // entero: se pierde el avance, no el tamaño medido.
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onProgress?.({
      loaded: buffer.byteLength,
      total,
      ratio: total ? buffer.byteLength / total : undefined,
    });
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  onProgress?.({ loaded: 0, total, ratio: total ? 0 : undefined });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.({ loaded, total, ratio: total ? Math.min(1, loaded / total) : undefined });
    }
  }

  const merged = new Uint8Array(loaded);
  let at = 0;
  for (const chunk of chunks) {
    merged.set(chunk, at);
    at += chunk.byteLength;
  }
  return merged;
}

/**
 * Guarda en la caché y, si el navegador dice que no cabe, hace sitio.
 *
 * Sin esto, la primera docente que llene la cuota vería fallar todas las
 * descargas siguientes para siempre. Se borra lo menos usado recientemente —
 * `lastAccessAt`, o la fecha de descarga si nunca se abrió — hasta que el put
 * pase o no quede nada que borrar.
 */
async function putWithEviction(id: string, url: string, response: Response): Promise<void> {
  const cache = await openMediaCache();
  if (!cache) throw new MediaDownloadError('No se pudo abrir el almacén de archivos.', id);

  for (;;) {
    try {
      await cache.put(url, response.clone());
      return;
    } catch (e) {
      if (!isQuotaError(e)) {
        throw new MediaDownloadError('No se pudo guardar el archivo.', id, e);
      }
      const freed = await evictOldest(id);
      if (!freed) {
        throw new MediaDownloadError(
          'No queda espacio en el dispositivo para guardar este archivo.',
          id,
          e,
        );
      }
    }
  }
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

/** Borra el archivo menos usado recientemente. False si no quedaba ninguno. */
async function evictOldest(exceptId: string): Promise<boolean> {
  const all = (await listDownloaded()).filter((m) => m.id !== exceptId);
  if (all.length === 0) return false;
  const oldest = all.reduce((a, b) =>
    (a.lastAccessAt ?? a.downloadedAt) <= (b.lastAccessAt ?? b.downloadedAt) ? a : b,
  );
  await remove(oldest.id);
  return true;
}

/** Borra la copia local. Primero los bytes, luego el registro: al revés, un
 *  fallo a mitad dejaría bytes que nadie sabe que existen. */
export async function remove(id: string): Promise<void> {
  const meta = await readMeta(id);
  if (!meta) return;
  const cache = await openMediaCache();
  try {
    await cache?.delete(meta.url);
  } catch {
    /* best-effort */
  }
  try {
    await deleteRecord(STORES.mediaIndex, id);
  } catch {
    /* best-effort */
  }
}

/** Todo lo descargado — alimenta la pantalla de descargas (PWA-2.12). */
export async function listDownloaded(): Promise<MediaIndexRecord[]> {
  if (!isIdbAvailable()) return [];
  try {
    return await getAllRecords<MediaIndexRecord>(STORES.mediaIndex);
  } catch {
    return [];
  }
}

/** Bytes ocupados por el contenido descargado. Medidos, no anunciados. */
export async function totalDownloadedBytes(): Promise<number> {
  return (await listDownloaded()).reduce((sum, m) => sum + (m.sizeBytes || 0), 0);
}

import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Generic offline cache for remote files (PDFs, videos, images). Native builds
// use expo-file-system; the web/PWA uses the browser Cache API so the page can
// still run without relying on native Directory/File APIs.
//
// The JSON index stays in AsyncStorage on every platform. On web that storage
// is backed by IndexedDB/localStorage by the AsyncStorage web adapter, while
// binary files are kept in a named Cache Storage bucket.

const INDEX_KEY = 'offline-content-index-v1';
const WEB_CACHE_NAME = 'suenosyletras-media-v1';
const WEB_CACHE_KEY_BASE = 'https://offline.suenosyletras.local/media/';

export interface DownloadedResourceMeta {
  id: string;
  url: string;
  fileName: string;
  /** Opaque version/ETag/updatedAt supplied by the caller — compare against the
   * backend's current value to decide whether a re-download is needed. */
  version?: string;
  sizeBytes: number;
  downloadedAt: number;
}

type Index = Record<string, DownloadedResourceMeta>;

async function readIndex(): Promise<Index> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  return raw ? (JSON.parse(raw) as Index) : {};
}

async function writeIndex(index: Index): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

const isWeb = Platform.OS === 'web';

// IMPORTANT: do not construct Directory/Paths on web. expo-file-system exposes
// these classes there, but their native path validation is not available in the
// browser and can crash the app during module initialization.
const downloadsDir = isWeb ? null : new Directory(Paths.document, 'downloads');

const webObjectUrls = new Map<string, string>();

function ensureDownloadsDir(): void {
  if (!downloadsDir) return;
  if (!downloadsDir.exists) downloadsDir.create({ intermediates: true });
}

function fileNameFor(id: string, url: string): string {
  const match = /\.[a-zA-Z0-9]+$/.exec(new URL(url).pathname);
  const extension = match ? match[0] : '';
  return id.replace(/[^a-zA-Z0-9_-]/g, '_') + extension;
}

function webCacheKey(id: string): Request {
  return new Request(`${WEB_CACHE_KEY_BASE}${encodeURIComponent(id)}`);
}

async function getWebCache(): Promise<Cache | null> {
  if (!isWeb || typeof globalThis.caches === 'undefined') return null;
  return globalThis.caches.open(WEB_CACHE_NAME);
}

async function getWebObjectUrl(id: string): Promise<string | null> {
  const cached = webObjectUrls.get(id);
  if (cached) return cached;

  const cache = await getWebCache();
  if (!cache) return null;
  const response = await cache.match(webCacheKey(id));
  if (!response) return null;

  const blob = await response.blob();
  const uri = URL.createObjectURL(blob);
  webObjectUrls.set(id, uri);
  return uri;
}

/** True if the resource was downloaded and the file is still on disk/cache. */
export async function isDownloaded(id: string): Promise<boolean> {
  const index = await readIndex();
  const meta = index[id];
  if (!meta) return false;

  if (isWeb) {
    const cache = await getWebCache();
    return !!cache && !!(await cache.match(webCacheKey(id)));
  }

  if (!downloadsDir) return false;
  return new File(downloadsDir, meta.fileName).exists;
}

/** Local URI to render/play the resource offline, or null if not downloaded. */
export async function getLocalUri(id: string): Promise<string | null> {
  const index = await readIndex();
  const meta = index[id];
  if (!meta) return null;

  if (isWeb) {
    return getWebObjectUrl(id);
  }

  if (!downloadsDir) return null;
  const file = new File(downloadsDir, meta.fileName);
  return file.exists ? file.uri : null;
}

/** Whether the locally cached copy is stale relative to `remoteVersion` (or missing entirely). */
export async function needsUpdate(id: string, remoteVersion: string | undefined): Promise<boolean> {
  const index = await readIndex();
  const meta = index[id];
  if (!meta) return true;
  if (!(await isDownloaded(id))) return true;
  return meta.version !== remoteVersion;
}

/** Downloads (or re-downloads) a resource and records it in the local index. */
export async function download(
  id: string,
  url: string,
  opts?: { version?: string; headers?: Record<string, string> },
): Promise<string> {
  if (isWeb) {
    const cache = await getWebCache();
    if (!cache) throw new Error('Cache Storage no está disponible en este navegador.');

    const response = await fetch(url, { headers: opts?.headers });
    if (!response.ok) {
      throw new Error(`No se pudo descargar el recurso (${response.status}).`);
    }

    await cache.put(webCacheKey(id), response.clone());

    const fileName = fileNameFor(id, url);
    const sizeHeader = response.headers.get('content-length');
    const sizeBytes = sizeHeader ? Number(sizeHeader) : (await response.clone().blob()).size;
    const index = await readIndex();
    index[id] = {
      id,
      url,
      fileName,
      version: opts?.version,
      sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
      downloadedAt: Date.now(),
    };
    await writeIndex(index);

    const existing = webObjectUrls.get(id);
    if (existing) URL.revokeObjectURL(existing);
    const uri = await getWebObjectUrl(id);
    if (!uri) throw new Error('El recurso se guardó, pero no pudo abrirse desde la caché.');
    return uri;
  }

  ensureDownloadsDir();
  if (!downloadsDir) throw new Error('Almacenamiento local nativo no disponible.');

  const fileName = fileNameFor(id, url);
  const destination = new File(downloadsDir, fileName);
  const result = await File.downloadFileAsync(url, destination, {
    idempotent: true,
    headers: opts?.headers,
  });

  const index = await readIndex();
  index[id] = {
    id,
    url,
    fileName,
    version: opts?.version,
    sizeBytes: result.size,
    downloadedAt: Date.now(),
  };
  await writeIndex(index);
  return result.uri;
}

/** Deletes the local copy of a resource (e.g. to free up storage). */
export async function remove(id: string): Promise<void> {
  const index = await readIndex();
  const meta = index[id];
  if (!meta) return;

  if (isWeb) {
    const cache = await getWebCache();
    await cache?.delete(webCacheKey(id));
    const objectUrl = webObjectUrls.get(id);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      webObjectUrls.delete(id);
    }
  } else if (downloadsDir) {
    const file = new File(downloadsDir, meta.fileName);
    if (file.exists) file.delete();
  }

  delete index[id];
  await writeIndex(index);
}

/** All resources currently downloaded — for a future "manage downloads" screen. */
export async function listDownloaded(): Promise<DownloadedResourceMeta[]> {
  return Object.values(await readIndex());
}

/** Total bytes used by downloaded content, for showing storage usage in Settings. */
export async function totalDownloadedBytes(): Promise<number> {
  return (await listDownloaded()).reduce((sum, meta) => sum + meta.sizeBytes, 0);
}

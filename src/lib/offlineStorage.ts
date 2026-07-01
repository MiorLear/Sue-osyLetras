import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Generic offline cache for remote files (PDFs, videos, images) — not tied to
// any specific screen. A resource is identified by a stable `id` (e.g. a
// backend record id or slug); the actual bytes live under the app's document
// directory so they survive app restarts and work with zero connectivity.
//
// Usage sketch (once a screen has a real `{ id, url }` to show):
//   const uri = await getLocalUri('manual-explorarte');
//   if (uri) { /* render from uri, no network needed */ }
//   else if (isOnline) { await download('manual-explorarte', remoteUrl); }

const INDEX_KEY = 'offline-content-index-v1';
const downloadsDir = new Directory(Paths.document, 'downloads');

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

function ensureDownloadsDir(): void {
  if (!downloadsDir.exists) downloadsDir.create({ intermediates: true });
}

function fileNameFor(id: string, url: string): string {
  const match = /\.[a-zA-Z0-9]+$/.exec(new URL(url).pathname);
  const extension = match ? match[0] : '';
  return id.replace(/[^a-zA-Z0-9_-]/g, '_') + extension;
}

/** True if the resource was downloaded and the file is still on disk. */
export async function isDownloaded(id: string): Promise<boolean> {
  const index = await readIndex();
  const meta = index[id];
  if (!meta) return false;
  return new File(downloadsDir, meta.fileName).exists;
}

/** Local file:// URI to render/play the resource offline, or null if not downloaded. */
export async function getLocalUri(id: string): Promise<string | null> {
  const index = await readIndex();
  const meta = index[id];
  if (!meta) return null;
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
  ensureDownloadsDir();
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
  if (meta) {
    const file = new File(downloadsDir, meta.fileName);
    if (file.exists) file.delete();
    delete index[id];
    await writeIndex(index);
  }
}

/** All resources currently downloaded — for a future "manage downloads" screen. */
export async function listDownloaded(): Promise<DownloadedResourceMeta[]> {
  return Object.values(await readIndex());
}

/** Total bytes used by downloaded content, for showing storage usage in Settings. */
export async function totalDownloadedBytes(): Promise<number> {
  return (await listDownloaded()).reduce((sum, meta) => sum + meta.sizeBytes, 0);
}

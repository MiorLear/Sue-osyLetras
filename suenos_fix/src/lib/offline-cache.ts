import AsyncStorage from '@react-native-async-storage/async-storage';

// Persists API JSON responses so screens can render offline. Separate from
// offlineStorage.ts, which caches the binary media files (videos/pdfs/images).
// Keys are namespaced and versioned so the schema can be bumped in one place.

const PREFIX = 'offline-data-v1:';

export async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // Best-effort: ignore quota / serialization errors.
  }
}

/** All cached content keyed by cacheKey — lets media-sync gather every MediaItem
 *  the app knows about without re-hitting the network. */
export async function readAllCached(): Promise<Record<string, unknown>> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    const entries = await AsyncStorage.multiGet(keys);
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      if (!v) continue;
      try {
        out[k.slice(PREFIX.length)] = JSON.parse(v);
      } catch {
        // skip corrupt entry
      }
    }
    return out;
  } catch {
    return {};
  }
}

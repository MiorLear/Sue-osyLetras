import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MediaItem, ScreenKey } from '@explorarte/shared';

import { api } from '@/lib/api';
import { writeCache } from '@/lib/offline-cache';
import { download, needsUpdate } from '@/lib/offlineStorage';
import { withSync } from '@/lib/sync-status';

// Proactive offline sync: when online, pull every read-only content response
// (emotions + details, tools, learning, screen intros) into the JSON cache and,
// on demand, download the media files they reference, so the whole content
// section works with zero connectivity afterward. Screens read this same cache
// via useOfflineAsync, so keys must match theirs.
//
// SCALE-03: this used to run in full — ~12 endpoints plus every referenced
// media file — on *every* flip of the `online` flag. A tablet flapping between
// Wi-Fi and cellular hammered the API and burned the teacher's data plan on
// video re-checks she never asked for. Two changes:
//
//   - the automatic pass is JSON only (kilobytes) and throttled to one run per
//     SYNC_WINDOW_MS, skipped entirely on a metered connection;
//   - downloading media (megabytes) is now an explicit user action.

const SCREEN_KEYS: ScreenKey[] = ['home', 'emotions', 'learning', 'tools'];

const LAST_SYNC_KEY = 'content-sync-last-at-v1';

/** Minimum gap between two automatic passes. */
export const SYNC_WINDOW_MS = 15 * 60_000;

async function cacheMedia(item: MediaItem | null | undefined): Promise<void> {
  if (!item?.url || !item.id) return;
  const version = String(item.sizeBytes ?? '');
  try {
    if (await needsUpdate(item.id, version)) {
      await download(item.id, item.url, { version });
    }
  } catch {
    // Per-file failure shouldn't abort the whole pass; the online fallback still works.
  }
}

/** Stand-in for cacheMedia on a JSON-only pass: keeps the walk identical. */
async function noMedia(_item: MediaItem | null | undefined): Promise<void> {
  /* media download is user-initiated — see downloadAllContent */
}

async function readLastSyncAt(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    const at = raw ? Number(raw) : 0;
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
}

async function markSynced(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch {
    /* best-effort */
  }
}

let running = false;

/**
 * Refreshes the offline content cache. `media: true` also downloads every
 * referenced file (only those whose version changed). No-op if a pass is
 * already running.
 */
async function runPass(media: boolean): Promise<void> {
  if (running) return;
  running = true;
  const pullMedia = media ? cacheMedia : noMedia;
  try {
    await withSync(async () => {
      // Screen intro videos (home / emotions / learning / tools)
      for (const key of SCREEN_KEYS) {
        try {
          const intro = await api.screenIntros.get(key);
          await writeCache(`screen-intro:${key}`, intro);
          await pullMedia(intro?.video);
        } catch {
          /* skip this screen */
        }
      }

      // Emotions: the list + each emotion's detail (its "Historias sugeridas" media)
      try {
        const emotions = await api.emotions.list();
        await writeCache('emotions:list', emotions);
        for (const e of emotions) {
          try {
            const detail = await api.emotions.get(e.id);
            await writeCache(`emotion:${e.id}`, detail);
            for (const story of detail?.content.stories ?? []) await pullMedia(story);
          } catch {
            /* skip this emotion */
          }
        }
      } catch {
        /* skip emotions */
      }

      // Tools: downloadables, activity guides, the featured manual
      try {
        const tools = await api.tools.get();
        await writeCache('tools', tools);
        for (const m of [...tools.downloadables, ...tools.activityGuides]) await pullMedia(m);
        await pullMedia(tools.manualDocument);
      } catch {
        /* skip tools */
      }

      // Learning: every subtopic's pdfs / videos / audios
      try {
        const topics = await api.learning.topics();
        await writeCache('learning:topics', topics);
        for (const t of topics) {
          for (const sub of t.subtopics) {
            for (const m of [...sub.pdfs, ...sub.videos, ...sub.audios]) await pullMedia(m);
          }
        }
      } catch {
        /* skip learning */
      }
    });
  } finally {
    running = false;
  }
}

/**
 * Full pass: JSON + every referenced media file. Megabytes of video and PDF, so
 * this is only ever started by the user ("Descargar contenido para usar sin
 * conexión"), never automatically.
 */
export async function syncAllContent(): Promise<void> {
  await runPass(true);
  await markSynced();
}

/** JSON-only pass: kilobytes, safe to run on reconnect. */
export async function syncContentJson(): Promise<void> {
  await runPass(false);
  await markSynced();
}

/**
 * The automatic pass, called on app start and on reconnect. Skips if a pass ran
 * within SYNC_WINDOW_MS — a tablet flapping between Wi-Fi and cellular flips
 * `online` many times a minute and must not re-walk the API each time — and
 * skips on a metered connection, where the teacher is paying per megabyte.
 * Returns whether a pass actually ran.
 */
export async function maybeSyncContent(options?: { metered?: boolean; force?: boolean }): Promise<boolean> {
  if (options?.metered && !options.force) return false;
  if (!options?.force && Date.now() - (await readLastSyncAt()) < SYNC_WINDOW_MS) return false;
  await syncContentJson();
  return true;
}

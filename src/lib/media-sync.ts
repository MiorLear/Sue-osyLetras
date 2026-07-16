import type { MediaItem, ScreenKey } from '@explorarte/shared';

import { api } from '@/lib/api';
import { writeCache } from '@/lib/offline-cache';
import { download, needsUpdate } from '@/lib/offlineStorage';
import { withSync } from '@/lib/sync-status';

// Proactive offline sync: when online, pull every read-only content response
// (emotions + details, tools, learning, screen intros) into the JSON cache AND
// download the media files they reference, so the whole content section works
// with zero connectivity afterward. Screens read this same cache via
// useOfflineAsync, so keys must match theirs.

const SCREEN_KEYS: ScreenKey[] = ['home', 'emotions', 'learning', 'tools'];

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

let running = false;

/**
 * Refreshes the offline content cache + downloads its media. Safe to call on
 * every app open and on reconnect: re-fetches JSON (cheap) and only re-downloads
 * media whose size changed. No-op if a pass is already running.
 */
export async function syncAllContent(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await withSync(async () => {
      // Screen intro videos (home / emotions / learning / tools)
      for (const key of SCREEN_KEYS) {
        try {
          const intro = await api.screenIntros.get(key);
          await writeCache(`screen-intro:${key}`, intro);
          await cacheMedia(intro?.video);
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
            for (const story of detail?.content.stories ?? []) await cacheMedia(story);
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
        for (const m of [...tools.downloadables, ...tools.activityGuides]) await cacheMedia(m);
        await cacheMedia(tools.manualDocument);
      } catch {
        /* skip tools */
      }

      // Learning: every subtopic's pdfs / videos / audios
      try {
        const topics = await api.learning.topics();
        await writeCache('learning:topics', topics);
        for (const t of topics) {
          for (const sub of t.subtopics) {
            for (const m of [...sub.pdfs, ...sub.videos, ...sub.audios]) await cacheMedia(m);
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

import type { MediaItem } from '@explorarte/shared';

import { api } from '@/lib/api';
import { readMetaValue, writeMetaValue } from '@/lib/app-meta';
import { cacheKeys, type IntroScreen } from '@/lib/cache-keys';
import { download, listDownloaded, needsUpdate, remove } from '@/lib/media-cache';
import { isMediaUrl } from '@/lib/media-origins';
import { readAllCached, writeCache } from '@/lib/offline-cache';
import { withSync } from '@/lib/sync-status';

// La pasada que llena la caché offline sin que nadie tenga que abrir pantalla
// por pantalla. Puerto de src/lib/media-sync.ts, con la separación que impone
// SCALE-03 y que es la razón de ser de este modulo:
//
//   - El JSON son kilobytes: se precarga solo, al arrancar y al reconectar.
//   - Los medios son megabytes de video y PDF: NO se bajan nunca de rebote.
//     Solo desde un botón, porque quien paga esos megas es la docente.
//
// La versión RN hacía las dos cosas en cada flip de `online`. Una tablet que
// salta entre wifi y datos móviles cambia esa bandera muchas veces por minuto:
// martilleaba la API y se comía el plan de datos revalidando videos que nadie
// había pedido.

const SCREEN_KEYS: IntroScreen[] = ['home', 'emotions', 'learning', 'tools'];

/** Ranura con el instante de la última pasada completada. */
const LAST_SYNC_KEY = 'content-sync.last-at';

/** Mínimo entre dos pasadas automáticas. */
export const SYNC_WINDOW_MS = 15 * 60_000;

export interface SyncResult {
  /** Claves de caché escritas. */
  written: string[];
  /** Ids de medios descargados en esta pasada. */
  downloaded: string[];
  /** Ids de medios borrados por no referenciarlos ya ningún contenido. */
  pruned: string[];
  /** Qué falló, con su id: un recurso roto no puede desaparecer sin dejar rastro. */
  failures: { id: string; reason: string }[];
  /** False si algún endpoint falló; entonces no se limpia nada (ver prune). */
  complete: boolean;
}

function emptyResult(): SyncResult {
  return { written: [], downloaded: [], pruned: [], failures: [], complete: true };
}

/**
 * Conexión medida: la usuaria paga por megabyte o ha pedido ahorrar datos.
 * `saveData` es una preferencia explícita suya, así que se respeta incluso para
 * el JSON — el contenido cacheado que ya tiene sigue sirviendo.
 */
export function isMeteredConnection(): boolean {
  const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (!conn) return false;
  if (conn.saveData === true) return true;
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
}

// ── recorrido del contenido ──────────────────────────────────────────────────

/** Todos los MediaItem que cuelgan de un valor cacheado, sea cual sea su forma. */
function mediaFrom(value: unknown, out: Map<string, MediaItem>): void {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const entry of value) mediaFrom(entry, out);
    return;
  }

  const record = value as Record<string, unknown>;
  // Un MediaItem se reconoce por tener id y url; lo demás se sigue recorriendo.
  if (typeof record.id === 'string' && typeof record.url === 'string') {
    out.set(record.id, record as unknown as MediaItem);
    return;
  }
  for (const entry of Object.values(record)) mediaFrom(entry, out);
}

/**
 * Cada MediaItem que el contenido cacheado referencia hoy, por id.
 *
 * Recorre la forma en vez de conocerla campo a campo a propósito: si mañana el
 * API añade adjuntos en otro sitio, la descarga y la limpieza los ven sin que
 * nadie tenga que acordarse de tocar dos listas que se desincronizan.
 */
export async function collectMediaItems(): Promise<MediaItem[]> {
  const found = new Map<string, MediaItem>();
  const cached = await readAllCached();
  for (const value of Object.values(cached)) mediaFrom(value, found);
  return [...found.values()];
}

// ── la pasada ────────────────────────────────────────────────────────────────

type Writer = (key: string, value: unknown) => Promise<void>;

/** Recorre los endpoints de lectura. Un fallo salta ese trozo, no la pasada. */
async function walkContent(write: Writer, result: SyncResult): Promise<void> {
  for (const screen of SCREEN_KEYS) {
    try {
      const intro = await api.screenIntros.get(screen);
      await write(cacheKeys.screenIntro(screen), intro);
    } catch (e) {
      result.complete = false;
      result.failures.push({ id: `screen-intro:${screen}`, reason: reasonOf(e) });
    }
  }

  try {
    const emotions = await api.emotions.list();
    await write(cacheKeys.emotionsList(), emotions);
    for (const emotion of emotions) {
      try {
        const detail = await api.emotions.get(emotion.id);
        await write(cacheKeys.emotion(emotion.id), detail);
      } catch (e) {
        result.complete = false;
        result.failures.push({ id: `emotion:${emotion.id}`, reason: reasonOf(e) });
      }
    }
  } catch (e) {
    result.complete = false;
    result.failures.push({ id: 'emotions:list', reason: reasonOf(e) });
  }

  try {
    await write(cacheKeys.tools(), await api.tools.get());
  } catch (e) {
    result.complete = false;
    result.failures.push({ id: 'tools', reason: reasonOf(e) });
  }

  try {
    await write(cacheKeys.learningTopics(), await api.learning.topics());
  } catch (e) {
    result.complete = false;
    result.failures.push({ id: 'learning:topics', reason: reasonOf(e) });
  }

  // Las tres pantallas donde la docente ESCRIBE. Faltaban, y eso dejaba la
  // escritura sin conexión fuera de su alcance justo donde importa: quien
  // pierde la señal antes de abrir Comunidad se la encuentra vacía, y en una
  // pantalla vacía no hay nada que comentar ni a qué reaccionar. Van al final
  // porque son de la usuaria y no contenido común: si algo se queda a medias,
  // que sea esto y no la biblioteca que comparten todas.
  try {
    await write(cacheKeys.posts(undefined), await api.posts.list());
  } catch (e) {
    result.complete = false;
    result.failures.push({ id: 'posts', reason: reasonOf(e) });
  }

  try {
    await write(cacheKeys.events(), await api.events.list());
  } catch (e) {
    result.complete = false;
    result.failures.push({ id: 'events', reason: reasonOf(e) });
  }

  try {
    await write(cacheKeys.profile(), await api.profile.get());
  } catch (e) {
    result.complete = false;
    result.failures.push({ id: 'profile', reason: reasonOf(e) });
  }
}

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

let running: Promise<SyncResult> | null = null;

/** Pasada de solo JSON. Kilobytes: se puede correr al reconectar. */
export async function syncContentJson(): Promise<SyncResult> {
  return runPass(false);
}

/**
 * Pasada completa: JSON más cada archivo referenciado.
 *
 * Megabytes. Esto SOLO se llama desde un botón — nunca desde un efecto, nunca
 * al reconectar. Es la mitad de SCALE-03.
 */
export async function syncAllContent(
  onProgress?: (done: number, total: number, title: string) => void,
): Promise<SyncResult> {
  return runPass(true, onProgress);
}

async function runPass(
  media: boolean,
  onProgress?: (done: number, total: number, title: string) => void,
): Promise<SyncResult> {
  // Dos pasadas a la vez recorrerían la API por duplicado.
  if (running) return running;

  const task = withSync(async () => {
    const result = emptyResult();
    const written: string[] = [];

    await walkContent(async (key, value) => {
      await writeCache(key, value);
      written.push(key);
    }, result);
    result.written = written;

    if (media) await downloadAll(result, onProgress);

    // La limpieza va al final Y solo si todo se recorrió: con la caché a medias
    // por un endpoint caído, "no referenciado" significa "no lo pude leer", y
    // borraríamos archivos buenos que la docente tendría que volver a bajar.
    if (result.complete) await pruneOrphanedMedia(result);

    await writeMetaValue(LAST_SYNC_KEY, Date.now());
    return result;
  }).finally(() => {
    running = null;
  });

  running = task;
  return task;
}

/** Descarga lo que falte o haya cambiado. Un archivo roto no para al resto. */
async function downloadAll(
  result: SyncResult,
  onProgress?: (done: number, total: number, title: string) => void,
): Promise<void> {
  const items = await collectMediaItems();
  let done = 0;

  for (const item of items) {
    onProgress?.(done, items.length, item.title);
    done += 1;

    // BUG-10: una URL malformada se registra con su id. Antes se tragaba en
    // silencio, que es peor que un error — la pasada parecía haber funcionado y
    // el archivo simplemente no estaba cuando hacía falta.
    if (!item.url || !isMediaUrl(item.url)) {
      const reason = `URL no utilizable: ${item.url || '(vacía)'}`;
      console.warn(`[content-sync] ${item.id}: ${reason}`);
      result.failures.push({ id: item.id, reason });
      continue;
    }

    try {
      const version = String(item.sizeBytes ?? '');
      if (await needsUpdate(item.id, version)) {
        await download(item.id, item.url, { version });
        result.downloaded.push(item.id);
      }
    } catch (e) {
      const reason = reasonOf(e);
      console.warn(`[content-sync] ${item.id}: ${reason}`);
      result.failures.push({ id: item.id, reason });
    }
  }

  onProgress?.(items.length, items.length, '');
}

/**
 * Borra los archivos que ya no referencia ningún contenido (BUG-11).
 *
 * Sin esto, cambiar el PDF de una herramienta deja el viejo ocupando espacio
 * para siempre: nada lo enseña y nada lo borra.
 */
export async function pruneOrphanedMedia(result: SyncResult = emptyResult()): Promise<string[]> {
  const referenced = new Set((await collectMediaItems()).map((m) => m.id));
  const stored = await listDownloaded();

  for (const record of stored) {
    if (referenced.has(record.id)) continue;
    try {
      await remove(record.id);
      result.pruned.push(record.id);
    } catch (e) {
      result.failures.push({ id: record.id, reason: reasonOf(e) });
    }
  }
  return result.pruned;
}

// ── la pasada automática ─────────────────────────────────────────────────────

/**
 * Lo que llama la app al arrancar y al reconectar.
 *
 * Devuelve si llegó a correr. Se salta cuando otra pasada corrió hace menos de
 * SYNC_WINDOW_MS o cuando la conexión es medida; `force` es para el botón de
 * "actualizar ahora", que sí es una decisión de la usuaria.
 */
export async function maybeSyncContent(options: { force?: boolean } = {}): Promise<boolean> {
  if (!options.force) {
    if (isMeteredConnection()) return false;
    const last = (await readMetaValue<number>(LAST_SYNC_KEY)) ?? 0;
    if (Number.isFinite(last) && Date.now() - last < SYNC_WINDOW_MS) return false;
  }
  await syncContentJson();
  return true;
}

/** Test-only: olvida la marca de la última pasada. */
export async function __resetSyncWindow(): Promise<void> {
  await writeMetaValue(LAST_SYNC_KEY, 0);
}

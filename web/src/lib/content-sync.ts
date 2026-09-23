import type { MediaItem } from '@explorarte/shared';

import { api } from '@/lib/api';
import { readMetaValue, writeMetaValue } from '@/lib/app-meta';
import { cacheKeys, type IntroScreen } from '@/lib/cache-keys';
import { download, listDownloaded, mediaVersion, needsUpdate, remove } from '@/lib/media-cache';
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

/** Tope de peticiones a la vez. Ver walkContent. */
const WALK_CONCURRENCY = 6;

/** Recorre `items` con `limit` tareas a la vez, en orden de llegada. */
async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      await fn(items[next++]);
    }
  });
  await Promise.all(workers);
}

/**
 * Recorre los endpoints de lectura. Un fallo salta ese trozo, no la pasada.
 *
 * Va en dos olas con un tope de {@link WALK_CONCURRENCY} peticiones a la vez.
 * Antes era una fila india de ~18 `await`, uno detras de otro, y eso convertia
 * cualquier lentitud del servidor en esa lentitud multiplicada por 18. Con el
 * API sano la diferencia ya se nota; con el API arrancando en frio era la
 * diferencia entre esperar y rendirse.
 *
 * El tope no es decorativo: soltar las 18 de golpe contra una instancia fria
 * solo consigue que se encolen todas tras el mismo arranque, y en datos moviles
 * es ademas un golpe innecesario. Seis es el punto razonable.
 */
async function walkContent(write: Writer, result: SyncResult): Promise<void> {
  const step = async (id: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (e) {
      result.complete = false;
      result.failures.push({ id, reason: reasonOf(e) });
    }
  };

  // Ola 1: todo lo que no depende de ninguna otra respuesta.
  //
  // Entre ellas van las tres pantallas donde la docente ESCRIBE (comunidad,
  // calendario y perfil). Faltaban, y eso dejaba la escritura sin conexion
  // fuera de su alcance justo donde importa: quien pierde la senal antes de
  // abrir Comunidad se la encuentra vacia, y en una pantalla vacia no hay nada
  // que comentar ni a que reaccionar. Antes iban las ultimas a proposito, para
  // que un corte a medias se llevara esto y no la biblioteca comun; ahora todo
  // se intenta siempre, asi que ese orden ya no significa nada.
  let emotions: Awaited<ReturnType<typeof api.emotions.list>> = [];
  const independent: (() => Promise<void>)[] = [
    ...SCREEN_KEYS.map((screen) => () =>
      step(`screen-intro:${screen}`, async () => {
        await write(cacheKeys.screenIntro(screen), await api.screenIntros.get(screen));
      }),
    ),
    () =>
      step('emotions:list', async () => {
        emotions = await api.emotions.list();
        await write(cacheKeys.emotionsList(), emotions);
      }),
    () =>
      step('tools', async () => {
        await write(cacheKeys.tools(), await api.tools.get());
      }),
    () =>
      step('learning:topics', async () => {
        await write(cacheKeys.learningTopics(), await api.learning.topics());
      }),
    () =>
      step('posts', async () => {
        await write(cacheKeys.posts(undefined), await api.posts.list());
      }),
    () =>
      step('events', async () => {
        await write(cacheKeys.events(), await api.events.list());
      }),
    () =>
      step('profile', async () => {
        await write(cacheKeys.profile(), await api.profile.get());
      }),
    // El avance por el mapa de fases. Tambien es de la usuaria, no contenido
    // comun: sin el, abrir el mapa sin conexion mostraria todo por empezar.
    () =>
      step('learning:progress', async () => {
        await write(cacheKeys.learningProgress(), await api.learning.progress());
      }),
  ];
  await mapPool(independent, WALK_CONCURRENCY, (task) => task());

  // Ola 2: un detalle por emocion. Si la lista fallo, `emotions` sigue vacia y
  // esto no hace nada, igual que cuando el bucle colgaba del try de la lista.
  await mapPool(emotions, WALK_CONCURRENCY, (emotion) =>
    step(`emotion:${emotion.id}`, async () => {
      await write(cacheKeys.emotion(emotion.id), await api.emotions.get(emotion.id));
    }),
  );
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
      const version = mediaVersion(item);
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

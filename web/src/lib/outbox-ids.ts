import {
  STORES,
  isIdbAvailable,
  req,
  scopedKey,
  withTx,
  type ApiCacheRecord,
  type IdMapRecord,
} from '@/lib/idb';
import { cacheKeys } from '@/lib/cache-keys';
import { getCacheUser } from '@/lib/offline-cache';

// Los ids que la app se inventa mientras no hay servidor, y la máquina que los
// sustituye por los de verdad cuando lo hay.
//
// El problema que resuelve es concreto: una docente publica sin conexión y le
// da "me gusta" a su propia publicación. El "me gusta" tiene que salir DESPUÉS
// del alta, contra un id que en el momento de encolarlo todavía no existe. La
// versión RN solo tenía mapa para publicaciones (`src/lib/mutation-queue.ts`);
// para eventos plegaba la edición dentro del alta pendiente, y por eso arrastra
// un fallo vivo: si el alta ya sincronizó y salió de la cola, la edición se
// encola contra `tmp-…` y da 404 para siempre.
//
// Aquí vive solo lo que es de los ids: acuñarlos, reconocerlos, guardar el
// mapeo y coser la lista cacheada. Reescribir las filas ya encoladas vive en
// `outbox.ts`, que es donde están las clases de mutación — así este módulo no
// importa a aquél y no hay ciclo.

/** Prefijo de un id de evento inventado por el cliente. */
export const TEMP_EVENT_PREFIX = 'tmp-';

/**
 * Suelo de los ids de publicación inventados. No se puede prefijar un número,
 * así que se reconocen por magnitud. La secuencia del servidor no llega a 1e12
 * ni en mil vidas de este producto.
 */
export const TEMP_POST_ID_FLOOR = 1e12;

/** Cuántos mapeos se conservan como mucho. */
export const ID_MAP_LIMIT = 200;

/** Y cuánto vive uno, lo que muerda primero. */
export const ID_MAP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type MappedEntity = 'event' | 'post';

let mintCounter = 0;

/** Id provisional para un evento creado sin conexión. */
export function newTempEventId(): string {
  return (
    TEMP_EVENT_PREFIX +
    Date.now().toString(36) +
    Math.floor(Math.random() * 1e6).toString(36)
  );
}

/** True para un id de evento que el servidor no ha visto nunca. */
export function isTempEventId(id: string): boolean {
  return id.startsWith(TEMP_EVENT_PREFIX);
}

/**
 * Id provisional para una publicación creada sin conexión.
 *
 * `Date.now()` a secas NO vale: dos publicaciones en el mismo milisegundo —un
 * doble toque en "Publicar", o un test— saldrían con el mismo id, y entonces un
 * id provisional apuntaría a dos publicaciones del servidor y los "me gusta" de
 * una se pegarían a la otra. Con el contador dentro del milisegundo sigue
 * siendo cronológico (que es de lo que se aprovecha la poda) y además único.
 */
export function newTempPostId(): number {
  mintCounter = (mintCounter + 1) % 1000;
  return Date.now() * 1000 + mintCounter;
}

/** True para un id de publicación que el servidor no ha visto nunca. */
export function isTempPostId(id: number): boolean {
  return id >= TEMP_POST_ID_FLOOR;
}

// ── el mapa ──────────────────────────────────────────────────────────────────

/**
 * Clave del mapeo. Lleva la entidad dentro y no solo el id provisional para que
 * la búsqueda sea total —quien pregunta siempre sabe si busca un evento o una
 * publicación— en vez de depender de que los dos espacios de nombres (`tmp-…` y
 * numérico) no colisionen jamás, que hoy se cumple por accidente.
 */
function mapKey(userId: string, entity: MappedEntity, tempId: string | number): string {
  return scopedKey(userId, `${entity}:${tempId}`);
}

/** El id real, si el alta ya sincronizó. Dentro de una transacción ya abierta. */
export async function readMappedInTx(
  tx: IDBTransaction,
  userId: string,
  entity: MappedEntity,
  tempId: string | number,
): Promise<string | undefined> {
  const row = await req<IdMapRecord | undefined>(
    tx.objectStore(STORES.idMap).get(mapKey(userId, entity, tempId)),
  );
  // Defensivo, igual que en offline-cache: una fila solo se alcanza por la
  // clave compuesta de su propia usuaria, pero nunca se sirve una cuya dueña
  // declarada no coincida.
  return row && row.userId === userId ? row.serverId : undefined;
}

/** El id real de un evento si su alta ya sincronizó; el mismo id si no. */
export async function resolveEventId(id: string): Promise<string> {
  if (!isTempEventId(id) || !isIdbAvailable()) return id;
  try {
    const userId = getCacheUser();
    const mapped = await withTx(STORES.idMap, 'readonly', (tx) =>
      readMappedInTx(tx, userId, 'event', id),
    );
    return mapped ?? id;
  } catch {
    return id;
  }
}

/** El id real de una publicación si su alta ya sincronizó; el mismo id si no. */
export async function resolvePostId(id: number): Promise<number> {
  if (!isTempPostId(id) || !isIdbAvailable()) return id;
  try {
    const userId = getCacheUser();
    const mapped = await withTx(STORES.idMap, 'readonly', (tx) =>
      readMappedInTx(tx, userId, 'post', id),
    );
    const parsed = mapped === undefined ? NaN : Number(mapped);
    return Number.isFinite(parsed) ? parsed : id;
  } catch {
    return id;
  }
}

/** Guarda el mapeo. En la transacción del llamador: nunca abre la suya. */
export function putMappingInTx(
  tx: IDBTransaction,
  userId: string,
  entity: MappedEntity,
  tempId: string | number,
  serverId: string,
): void {
  const record: IdMapRecord = {
    id: mapKey(userId, entity, tempId),
    userId,
    tempId: String(tempId),
    entity,
    serverId,
    mappedAt: Date.now(),
  };
  tx.objectStore(STORES.idMap).put(record);
}

/**
 * Poda el mapa por tamaño y por edad.
 *
 * Se puede podar sin miedo precisamente por la costura de abajo: cuando la
 * lista cacheada pasa a llevar el id de verdad, ya no queda ninguna referencia
 * viva al provisional. El mapa es una ayuda de reconciliación de vida corta, no
 * una tabla de identidad permanente. Sin límite, en una tablet de uso diario
 * crecería para siempre.
 */
export async function pruneIdMapInTx(tx: IDBTransaction, userId: string): Promise<void> {
  const rows = await req<IdMapRecord[]>(
    tx.objectStore(STORES.idMap).index('by-user').getAll(IDBKeyRange.only(userId)),
  );
  const cutoff = Date.now() - ID_MAP_MAX_AGE_MS;
  const store = tx.objectStore(STORES.idMap);
  const fresh = rows.filter((r) => {
    if (r.mappedAt < cutoff) {
      store.delete(r.id);
      return false;
    }
    return true;
  });
  if (fresh.length <= ID_MAP_LIMIT) return;
  fresh
    .sort((a, b) => a.mappedAt - b.mappedAt)
    .slice(0, fresh.length - ID_MAP_LIMIT)
    .forEach((r) => store.delete(r.id));
}

// ── la costura con la caché ──────────────────────────────────────────────────

/** Lo que devolvió el servidor al crear. Solo se mira su `id`; el resto viaja
 *  entero a la lista cacheada, sea un `CalEvent` o un `Post`. */
export type CreatedRow = { id: unknown } & Record<string, unknown>;

/** Compara ids de tipos distintos (el de evento es texto, el de post número). */
function sameId(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

/**
 * Sustituye la fila provisional por la del servidor en las listas cacheadas.
 *
 * Hace falta por un hueco que la capa optimista de las pantallas no alcanza:
 * cuando el alta ya sincronizó y salió de la cola, no queda mutación pendiente
 * de la que derivar nada, pero la lista guardada sigue siendo la de antes. Sin
 * esto, recargar sin conexión justo después de sincronizar no enseña lo que la
 * docente acaba de crear.
 *
 * Se filtra por LOS DOS ids —el provisional y el real— porque sin el real un
 * remapeo repetido dejaría la fila dos veces. Y `fetchedAt` no se toca: la
 * lista sigue siendo tan vieja como su última revalidación, y mentir sobre su
 * edad rompe el aviso de contenido caducado (BUG-09).
 */
export async function stitchCreatedInTx(
  tx: IDBTransaction,
  userId: string,
  entity: MappedEntity,
  tempId: string | number,
  created: CreatedRow,
): Promise<void> {
  const store = tx.objectStore(STORES.apiCache);
  // Una publicación vive en `posts:todos` y además en `posts:<emoción>` si va
  // etiquetada, así que hay que tocar todas sus entradas; un evento vive en una
  // sola. `readAllCachedEntries()` no sirve aquí: abre su propia transacción y
  // rompería la atomicidad de la que depende todo el remapeo.
  const rows =
    entity === 'post'
      ? (
          await req<ApiCacheRecord[]>(
            store.index('by-user').getAll(IDBKeyRange.only(userId)),
          )
        ).filter((r) => r.cacheKey.startsWith('posts:'))
      : await (async () => {
          const row = await req<ApiCacheRecord | undefined>(
            store.get(scopedKey(userId, cacheKeys.events())),
          );
          return row ? [row] : [];
        })();

  for (const row of rows) {
    if (row.userId !== userId || !Array.isArray(row.data)) continue;
    const list = row.data as { id: unknown }[];
    const rest = list.filter((e) => !sameId(e.id, tempId) && !sameId(e.id, created.id));
    store.put({ ...row, data: [...rest, created] });
  }
}

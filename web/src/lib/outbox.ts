import type {
  CreateCommentInput,
  CreateEventInput,
  CreatePostInput,
  UpdateEventInput,
  UpdateProfileInput,
} from '@explorarte/shared';

import {
  STORES,
  isIdbAvailable,
  req,
  withTx,
  type OutboxRecord,
  type OutboxStatus,
} from '@/lib/idb';
import { getCacheUser } from '@/lib/offline-cache';
import {
  isTempEventId,
  isTempPostId,
  pruneIdMapInTx,
  putMappingInTx,
  readMappedInTx,
  stitchCreatedInTx,
  type CreatedRow,
  type MappedEntity,
} from '@/lib/outbox-ids';
import { setPendingCount } from '@/lib/sync-status';

// La bandeja de salida: los cambios que la docente ya hizo y que el servidor
// todavía no tiene.
//
// Puerto de `src/lib/mutation-queue.ts`, que en RN vivía sobre AsyncStorage —en
// web eso es localStorage: ~5 MB, síncrono, solo texto, compartido con el token
// de sesión y completamente invisible para un service worker. IndexedDB no
// tiene ninguno de esos cuatro problemas, y el cuarto es el que decide: el
// replay desde el worker (PWA-3.5) jamás podría leer la cola desde allí.
//
// Dos propiedades mandan sobre todo lo demás:
//
//  1. TODA fila lleva su usuaria y toda lectura arranca filtrando por ella. Son
//     tablets compartidas de aula: que el trabajo de una docente no sea legible
//     ni despachable bajo la sesión de otra es un requisito de seguridad, no
//     una optimización.
//  2. Esta es la ÚNICA copia de algo que el servidor no tiene. La caché de
//     contenido se puede borrar sin coste porque es copia de lo que el servidor
//     ya tiene; esto no. De ahí que el replay nunca dispare una purga.

// ── las siete clases de cambio ───────────────────────────────────────────────

export type MutationKind =
  | 'profile.update'
  | 'event.create'
  | 'event.update'
  | 'event.remove'
  | 'post.create'
  | 'post.like'
  | 'post.comment';

export type Mutation =
  | { kind: 'profile.update'; input: UpdateProfileInput }
  | { kind: 'event.create'; tempId: string; input: CreateEventInput }
  | { kind: 'event.update'; targetId: string; input: UpdateEventInput }
  | { kind: 'event.remove'; targetId: string }
  | { kind: 'post.create'; tempId: number; input: CreatePostInput }
  | { kind: 'post.like'; postId: number }
  | { kind: 'post.comment'; postId: number; input: CreateCommentInput };

/** Una fila tal como la ven las pantallas y la lista de cambios sin enviar. */
export interface PendingMutation {
  seq: number;
  id: string;
  chainKey: string;
  mutation: Mutation;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: OutboxStatus;
  lastError?: string;
}

/**
 * La cadena es la INSTANCIA de entidad, no el tipo de cambio.
 *
 * Es la partición más fina que conserva las únicas restricciones de orden que
 * existen en este dominio —crear antes de editar, crear antes de borrar, crear
 * antes de comentar—, y las tres son dentro de una misma entidad. Agrupar por
 * tipo (`events`, `posts`) volvería a meter el atasco en cabeza que describe
 * BUG-03: una edición envenenada de un evento retendría a los otros doce. No
 * agrupar nada rompe crear-antes-de-editar: mientras el alta reintenta por un
 * 503, su edición saldría y recibiría un 404 contra un id que el servidor nunca
 * emitió, que además es permanente.
 *
 * `profile` no lleva id porque hay exactamente un perfil por usuaria y la fila
 * ya está acotada a ella.
 */
export function chainKeyOf(mutation: Mutation): string {
  switch (mutation.kind) {
    case 'profile.update':
      return 'profile';
    case 'event.create':
      return `event:${mutation.tempId}`;
    case 'event.update':
    case 'event.remove':
      return `event:${mutation.targetId}`;
    case 'post.create':
      return `post:${mutation.tempId}`;
    case 'post.like':
    case 'post.comment':
      return `post:${mutation.postId}`;
  }
}

// ── códec ────────────────────────────────────────────────────────────────────

function newRowId(): string {
  return 'm-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

/** Separa la clase del resto para guardarla; `seq` lo pone IndexedDB. */
export function toRecord(mutation: Mutation, userId: string): OutboxRecord {
  const { kind, ...payload } = mutation;
  return {
    id: newRowId(),
    userId,
    kind,
    payload,
    chainKey: chainKeyOf(mutation),
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    status: 'pending',
  };
}

/**
 * Reensambla la mutación. Devuelve `null` si la fila no tiene forma de ninguna
 * de las siete clases: una guardada por una versión anterior de la app, o un
 * clon a medias. Vale más mandarla a la lista de fallidos que reventar la
 * pasada entera con ella.
 */
export function toMutation(record: OutboxRecord): Mutation | null {
  const p = record.payload as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return null;
  const has = (k: string, t: 'string' | 'number' | 'object') =>
    t === 'object' ? typeof p[k] === 'object' && p[k] !== null : typeof p[k] === t;

  switch (record.kind as MutationKind) {
    case 'profile.update':
      return has('input', 'object') ? ({ kind: 'profile.update', ...p } as Mutation) : null;
    case 'event.create':
      return has('tempId', 'string') && has('input', 'object')
        ? ({ kind: 'event.create', ...p } as Mutation)
        : null;
    case 'event.update':
      return has('targetId', 'string') && has('input', 'object')
        ? ({ kind: 'event.update', ...p } as Mutation)
        : null;
    case 'event.remove':
      return has('targetId', 'string') ? ({ kind: 'event.remove', ...p } as Mutation) : null;
    case 'post.create':
      return has('tempId', 'number') && has('input', 'object')
        ? ({ kind: 'post.create', ...p } as Mutation)
        : null;
    case 'post.like':
      return has('postId', 'number') ? ({ kind: 'post.like', ...p } as Mutation) : null;
    case 'post.comment':
      return has('postId', 'number') && has('input', 'object')
        ? ({ kind: 'post.comment', ...p } as Mutation)
        : null;
    default:
      return null;
  }
}

/** La fila, ya reensamblada, o `null` si no se puede. */
export function toPending(record: OutboxRecord): PendingMutation | null {
  const mutation = toMutation(record);
  if (!mutation || record.seq === undefined) return null;
  return {
    seq: record.seq,
    id: record.id,
    chainKey: record.chainKey,
    mutation,
    createdAt: record.createdAt,
    attempts: record.attempts,
    nextAttemptAt: record.nextAttemptAt,
    status: record.status,
    lastError: record.lastError,
  };
}

// ── fusión de cambios ────────────────────────────────────────────────────────

export type CoalesceOp =
  | { type: 'delete'; seq: number }
  | { type: 'put'; record: OutboxRecord };

function payloadOf<T>(record: OutboxRecord): T {
  return record.payload as T;
}

/**
 * Decide qué se escribe cuando llega un cambio nuevo sobre una cadena.
 *
 * Es una función PURA a propósito: la tabla entera se prueba sin abrir la base
 * de datos. `chain` son las filas pendientes de esa cadena en orden de `seq`,
 * SIN las que están en vuelo — una fila que ya salió por la red no se puede
 * cancelar localmente, porque el servidor la va a recibir de todas formas y
 * borrarla aquí dejaría a la pantalla diciendo lo contrario que él. Ese es un
 * fallo real y vigente de la versión RN, que hace `splice` sobre una mutación
 * que puede estar despachándose en ese mismo momento.
 *
 * Distinción deliberada: FUSIONAR edita la fila en su sitio y conserva su
 * `seq`; REEMPLAZAR borra e inserta, y toma uno nuevo. Fusionar en el sitio es
 * lo que impide que una edición salte por delante del alta de su propia cadena.
 */
export function coalesce(chain: OutboxRecord[], incoming: OutboxRecord): CoalesceOp[] {
  const mutation = toMutation(incoming);
  if (!mutation) return [{ type: 'put', record: incoming }];
  const find = (kind: MutationKind) => chain.find((r) => r.kind === kind);

  switch (mutation.kind) {
    case 'profile.update': {
      // Lo último que escribió manda: guardar cinco veces sin conexión es un
      // cambio, no cinco, y el contador del aviso no puede decir otra cosa.
      const previous = find('profile.update');
      const ops: CoalesceOp[] = [];
      if (previous?.seq !== undefined) ops.push({ type: 'delete', seq: previous.seq });
      ops.push({ type: 'put', record: incoming });
      return ops;
    }

    case 'event.update': {
      const create = find('event.create');
      if (create) {
        // Plegar la edición dentro del alta pendiente: al reconectar sale una
        // sola llamada con el evento ya correcto, en vez de un alta y cuatro
        // correcciones de algo que la docente vivió como "crear un evento".
        const p = payloadOf<{ tempId: string; input: CreateEventInput }>(create);
        return [
          {
            type: 'put',
            record: { ...create, payload: { ...p, input: { ...p.input, ...mutation.input } } },
          },
        ];
      }
      const pendingUpdate = find('event.update');
      if (pendingUpdate) {
        const p = payloadOf<{ targetId: string; input: UpdateEventInput }>(pendingUpdate);
        return [
          {
            type: 'put',
            record: {
              ...pendingUpdate,
              payload: { ...p, input: { ...p.input, ...mutation.input } },
            },
          },
        ];
      }
      return [{ type: 'put', record: incoming }];
    }

    case 'event.remove': {
      const create = find('event.create');
      if (create) {
        // Crear y borrar sin conexión no tiene que llegar al servidor: si el
        // alta saliera, él crearía el evento y luego habría que borrarlo, y si
        // ese borrado falla la docente se queda con un evento que borró, ahora
        // visible en todos sus demás dispositivos.
        return chain
          .filter((r) => r.seq !== undefined)
          .map((r) => ({ type: 'delete', seq: r.seq! }) as CoalesceOp);
      }
      const ops: CoalesceOp[] = chain
        .filter((r) => r.kind === 'event.update' && r.seq !== undefined)
        .map((r) => ({ type: 'delete', seq: r.seq! }) as CoalesceOp);
      ops.push({ type: 'put', record: incoming });
      return ops;
    }

    case 'post.like': {
      // Pulsar dos veces es no haber pulsado: se anulan.
      const previous = find('post.like');
      if (previous?.seq !== undefined) return [{ type: 'delete', seq: previous.seq }];
      return [{ type: 'put', record: incoming }];
    }

    // Un alta es un alta y dos comentarios son dos comentarios: nunca se funden.
    case 'event.create':
    case 'post.create':
    case 'post.comment':
      return [{ type: 'put', record: incoming }];
  }
}

// ── avisos ───────────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();

/** Canal entre pestañas. Sin él, la segunda pestaña se queda con el contador
 *  rancio para siempre: lo que otra vacía, esta lo sigue anunciando. */
let channel: BroadcastChannel | null = null;
const CHANNEL_NAME = 'explorarte-outbox';

function ensureChannel(): void {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => {
      for (const l of listeners) l();
      void refreshPendingCount();
    };
  } catch {
    channel = null;
  }
}

/** Notifica tras cada escritura confirmada, sea de esta pestaña o de otra. */
export function subscribeOutbox(cb: () => void): () => void {
  ensureChannel();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Emite localmente y al resto de pestañas. */
export function emitOutboxChanged(): void {
  for (const l of listeners) l();
  ensureChannel();
  try {
    channel?.postMessage({ type: 'changed' });
  } catch {
    /* el canal puede estar cerrado si la pestaña se está descargando */
  }
}

// ── encolado ─────────────────────────────────────────────────────────────────

/**
 * Sustituye un id provisional por el real cuando el alta ya sincronizó.
 *
 * Sin esto, una edición encolada después de que el alta aterrizara saldría
 * contra `tmp-…` y daría 404 para siempre — que es el fallo que arrastra hoy la
 * versión RN, porque allí solo se miraba si el alta seguía PENDIENTE.
 */
async function resolveTargetInTx(
  tx: IDBTransaction,
  userId: string,
  mutation: Mutation,
): Promise<Mutation> {
  const lookup = async (entity: MappedEntity, tempId: string | number) =>
    readMappedInTx(tx, userId, entity, tempId);

  switch (mutation.kind) {
    case 'event.update':
    case 'event.remove': {
      if (!isTempEventId(mutation.targetId)) return mutation;
      const real = await lookup('event', mutation.targetId);
      return real ? { ...mutation, targetId: real } : mutation;
    }
    case 'post.like':
    case 'post.comment': {
      if (!isTempPostId(mutation.postId)) return mutation;
      const real = await lookup('post', mutation.postId);
      const parsed = real === undefined ? NaN : Number(real);
      return Number.isFinite(parsed) ? { ...mutation, postId: parsed } : mutation;
    }
    default:
      return mutation;
  }
}

/**
 * Apunta un cambio.
 *
 * Leer la cadena y escribirla ocurren en UNA transacción de escritura, y esto
 * no es cosmético. Si se leyera fuera, dos toques de "me gusta" —o dos
 * pestañas— leerían ambos "no hay nada pendiente", ambos insertarían, saldrían
 * dos toggles y la reacción de la docente desaparecería sin que nadie lo notara:
 * el servidor acabaría donde empezó y la pantalla enseñando lo contrario. Con
 * la lectura dentro, el navegador serializa las transacciones de escritura
 * sobre el mismo store —incluso entre pestañas— y la segunda ve lo que hizo la
 * primera.
 *
 * Regla operativa para todo este archivo: dentro de una transacción no se
 * espera NADA que no sea una petición de esa misma transacción. Cualquier otro
 * `await` le da el hueco para autoconfirmarse y la siguiente escritura lanza
 * `TransactionInactiveError`.
 */
async function enqueue(mutation: Mutation): Promise<void> {
  if (!isIdbAvailable()) return;
  const userId = getCacheUser();

  await withTx([STORES.outbox, STORES.idMap], 'readwrite', async (tx) => {
    const resolved = await resolveTargetInTx(tx, userId, mutation);
    const record = toRecord(resolved, userId);
    const store = tx.objectStore(STORES.outbox);
    const rows = await req<OutboxRecord[]>(
      store.index('by-user').getAll(IDBKeyRange.only(userId)),
    );
    const chain = rows.filter(
      (r) => r.chainKey === record.chainKey && r.status !== 'inflight',
    );
    for (const op of coalesce(chain, record)) {
      if (op.type === 'delete') store.delete(op.seq);
      else store.put(op.record);
    }
  });

  await refreshPendingCount();
  emitOutboxChanged();
}

/** Guarda los datos del perfil. Se queda con la última edición. */
export function enqueueProfileUpdate(input: UpdateProfileInput): Promise<void> {
  return enqueue({ kind: 'profile.update', input });
}

/** Crea un evento; `tempId` es el id provisional que la pantalla ya pinta. */
export function enqueueEventCreate(tempId: string, input: CreateEventInput): Promise<void> {
  return enqueue({ kind: 'event.create', tempId, input });
}

/** Edita un evento. Si su alta sigue pendiente, la edición se pliega dentro. */
export function enqueueEventUpdate(targetId: string, input: UpdateEventInput): Promise<void> {
  return enqueue({ kind: 'event.update', targetId, input });
}

/** Borra un evento. Si su alta sigue pendiente, cancela la cadena entera. */
export function enqueueEventRemove(targetId: string): Promise<void> {
  return enqueue({ kind: 'event.remove', targetId });
}

/** Publica; `tempId` es el id provisional que la pantalla ya pinta. */
export function enqueuePostCreate(tempId: number, input: CreatePostInput): Promise<void> {
  return enqueue({ kind: 'post.create', tempId, input });
}

/** Reacciona a una publicación. Dos veces seguidas se anula. */
export function enqueuePostLike(postId: number): Promise<void> {
  return enqueue({ kind: 'post.like', postId });
}

/** Comenta una publicación. */
export function enqueuePostComment(postId: number, input: CreateCommentInput): Promise<void> {
  return enqueue({ kind: 'post.comment', postId, input });
}

// ── remapeo de ids ───────────────────────────────────────────────────────────

/** Reescribe el objetivo de una fila si apunta al id provisional. */
function rewriteTarget(
  record: OutboxRecord,
  entity: MappedEntity,
  tempId: string | number,
  serverId: string,
): OutboxRecord | null {
  const p = record.payload as Record<string, unknown>;
  if (entity === 'event') {
    if (record.kind !== 'event.update' && record.kind !== 'event.remove') return null;
    if (p.targetId !== tempId) return null;
    return {
      ...record,
      payload: { ...p, targetId: serverId },
      chainKey: `event:${serverId}`,
    };
  }
  if (record.kind !== 'post.like' && record.kind !== 'post.comment') return null;
  if (p.postId !== tempId) return null;
  return {
    ...record,
    payload: { ...p, postId: Number(serverId) },
    chainKey: `post:${serverId}`,
  };
}

/**
 * El alta aterrizó: a partir de ahora el id provisional es el del servidor.
 *
 * Todo ocurre en la transacción del llamador —mapa, cola y caché— para que no
 * puedan discrepar entre sí. Si la pestaña muere en medio, o aterrizó todo o no
 * aterrizó nada; y "nada" significa que el alta se vuelve a despachar, es decir
 * un duplicado visible que la docente puede borrar. Es el modo de fallo honesto:
 * la ventana es un solo commit de IndexedDB, y cerrarla del todo exige una clave
 * de idempotencia que honre el servidor, que no existe todavía.
 *
 * Se reescribe el `chainKey` JUNTO al payload, y eso no es cosmética. Sin ello,
 * un "me gusta" encolado antes del sync y otro encolado después caerían en
 * cadenas distintas, la regla de anulación dejaría de aplicarse en silencio, y
 * el servidor acabaría con la reacción puesta mientras la pantalla la enseña
 * quitada.
 */
export async function applyRemapInTx(
  tx: IDBTransaction,
  userId: string,
  entity: MappedEntity,
  tempId: string | number,
  serverId: string,
  created: CreatedRow,
): Promise<void> {
  putMappingInTx(tx, userId, entity, tempId, serverId);

  const store = tx.objectStore(STORES.outbox);
  const rows = await req<OutboxRecord[]>(
    store.index('by-user').getAll(IDBKeyRange.only(userId)),
  );
  for (const row of rows) {
    const rewritten = rewriteTarget(row, entity, tempId, serverId);
    if (rewritten) store.put(rewritten);
  }

  await stitchCreatedInTx(tx, userId, entity, tempId, created);
  await pruneIdMapInTx(tx, userId);
}

// ── lectura ──────────────────────────────────────────────────────────────────

/** Las filas crudas de la usuaria, en orden de `seq`. */
export async function listRows(userId: string = getCacheUser()): Promise<OutboxRecord[]> {
  if (!isIdbAvailable()) return [];
  try {
    return await withTx(STORES.outbox, 'readonly', (tx) =>
      req<OutboxRecord[]>(
        tx.objectStore(STORES.outbox).index('by-user').getAll(IDBKeyRange.only(userId)),
      ),
    );
  } catch {
    return [];
  }
}

/** Lo que está esperando a salir, ya reensamblado. */
export async function listPending(): Promise<PendingMutation[]> {
  const rows = await listRows();
  return rows.map(toPending).filter((m): m is PendingMutation => m !== null);
}

/**
 * Recalcula el número que anuncia el aviso de la parte de arriba.
 *
 * Cuenta también las que están en vuelo: desde el punto de vista de la docente
 * siguen sin haber llegado. Los cambios que ya no se van a reintentar solos NO
 * se cuentan aquí — el aviso dice "se sincronizarán al reconectar", y de uno
 * muerto eso es mentira. Esos tienen su propio contador.
 */
export async function refreshPendingCount(): Promise<number> {
  const rows = await listRows();
  setPendingCount(rows.length);
  return rows.length;
}

/** Solo para tests: suelta los suscriptores y cierra el canal entre pestañas. */
export function __resetOutbox(): void {
  listeners.clear();
  try {
    channel?.close();
  } catch {
    /* ya cerrado */
  }
  channel = null;
}

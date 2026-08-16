import type {
  CreateCommentInput,
  CreateEventInput,
  CreatePostInput,
  UpdateEventInput,
  UpdateProfileInput,
} from '@explorarte/shared';

import { api } from '@/lib/api';
import {
  STORES,
  isIdbAvailable,
  req,
  withTx,
  type DeadLetterRecord,
  type OutboxRecord,
  type OutboxStatus,
} from '@/lib/idb';
import { getCacheUser } from '@/lib/offline-cache';
import { reportDeadSession } from '@/lib/offline-errors';
import {
  classifyReplayError,
  nextAttemptAt,
  orphanReason,
  resumePolicy,
  staleReason,
  unreadableReason,
  DEAD_LETTER_TTL_MS,
  OUTBOX_TTL_MS,
  type ReplayFailure,
} from '@/lib/outbox-errors';
import { checkReachability, isOnline } from '@/lib/useNetworkStatus';
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
import { setFailedCount, setPendingCount, withSync } from '@/lib/sync-status';

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

/** Lee los dos stores y publica ambos contadores. Único escritor de las ranuras. */
export async function refreshCounts(): Promise<{ pending: number; failed: number }> {
  const userId = getCacheUser();
  const [pending, failed] = await Promise.all([
    listRows(userId),
    listDeadRows(userId),
  ]);
  setPendingCount(pending.length);
  setFailedCount(failed.length);
  return { pending: pending.length, failed: failed.length };
}

/** Las filas apartadas de la usuaria. */
export async function listDeadRows(
  userId: string = getCacheUser(),
): Promise<DeadLetterRecord[]> {
  if (!isIdbAvailable()) return [];
  try {
    return await withTx(STORES.deadLetter, 'readonly', (tx) =>
      req<DeadLetterRecord[]>(
        tx.objectStore(STORES.deadLetter).index('by-user').getAll(IDBKeyRange.only(userId)),
      ),
    );
  } catch {
    return [];
  }
}

// ── reproducción ─────────────────────────────────────────────────────────────

/** Cuánto vale una reclama antes de darla por abandonada. */
const LEASE_MS = 60_000;

/**
 * Tope de vueltas por pasada. No es el criterio de terminación —lo es que cada
 * vuelta con progreso borra al menos una fila—, sino la red por si alguien
 * encola sin parar mientras la pasada corre.
 */
const MAX_SWEEPS = 50;

/** Identifica a esta pestaña. En memoria: muere con ella, que es el punto. */
const TAB_ID = 'tab-' + Math.random().toString(36).slice(2);

export interface PassResult {
  dispatched: number;
  dead: number;
  stopped: 'drained' | 'session' | 'unreachable' | 'skipped';
}

/** Lo que hay que remapear cuando un alta sale bien. */
type DispatchOutcome = { remap?: { entity: MappedEntity; tempId: string | number; serverId: string; created: CreatedRow } };

/**
 * Manda un cambio a la API. No toca IndexedDB a propósito: abrir una
 * transacción a caballo de un `await fetch` la autoconfirmaría en el primer
 * hueco, y además tendría bloqueadas a las demás pestañas durante toda la
 * petición.
 */
async function dispatch(mutation: Mutation): Promise<DispatchOutcome> {
  switch (mutation.kind) {
    case 'profile.update':
      await api.profile.update(mutation.input);
      return {};
    case 'event.create': {
      const created = await api.events.create(mutation.input);
      return created?.id
        ? {
            remap: {
              entity: 'event',
              tempId: mutation.tempId,
              serverId: String(created.id),
              created: created as unknown as CreatedRow,
            },
          }
        : {};
    }
    case 'event.update':
      await api.events.update(mutation.targetId, mutation.input);
      return {};
    case 'event.remove':
      await api.events.remove(mutation.targetId);
      return {};
    case 'post.create': {
      const created = await api.posts.create(mutation.input);
      return typeof created?.id === 'number'
        ? {
            remap: {
              entity: 'post',
              tempId: mutation.tempId,
              serverId: String(created.id),
              created: created as unknown as CreatedRow,
            },
          }
        : {};
    }
    case 'post.like':
      await api.posts.toggleLike(mutation.postId);
      return {};
    case 'post.comment':
      await api.posts.addComment(mutation.postId, mutation.input);
      return {};
  }
}

/**
 * Relee la fila y la reclama, en la MISMA transacción.
 *
 * Aquí está la defensa contra BUG-04, que sobre IndexedDB toma otra forma que
 * en RN: no hay ningún array compartido que se pueda cambiar bajo un bucle,
 * pero `getAll` devuelve objetos desconectados del store, y entre esa foto y el
 * despacho hay un `await` de red de segundos. En ese hueco la docente puede
 * cancelar el cambio, fundirlo con otro o reemplazarlo. Despachando desde la
 * foto se enviaría algo que ella deshizo y se borraría un `seq` que ya no
 * existe.
 *
 * Por eso el recorrido lleva claves primarias, no objetos, y lo que sale por la
 * red es lo que había en el store en el instante de reclamarlo. La reclama,
 * además, es lo que impide que dos pestañas despachen la misma fila: las
 * transacciones de escritura sobre un mismo store están serializadas entre
 * pestañas, así que exactamente una gana.
 */
async function claim(seq: number, userId: string): Promise<OutboxRecord | null> {
  const now = Date.now();
  return withTx(STORES.outbox, 'readwrite', async (tx) => {
    const store = tx.objectStore(STORES.outbox);
    const row = await req<OutboxRecord | undefined>(store.get(seq));
    if (!row) return null; // cancelada o fundida mientras esperábamos
    if (row.userId !== userId) return null; // cambió la sesión a mitad de pasada
    if (row.nextAttemptAt > now) return null; // su cadena todavía está esperando
    if (row.status === 'inflight' && (row.leaseUntil ?? 0) > now) return null; // otra pestaña
    const next: OutboxRecord = {
      ...row,
      status: 'inflight',
      leaseOwner: TAB_ID,
      leaseUntil: now + LEASE_MS,
    };
    store.put(next);
    return next;
  });
}

/** True si la fila sigue siendo nuestra; si no, alguien la reemplazó por debajo. */
function stillOurs(row: OutboxRecord | undefined, seq: number): row is OutboxRecord {
  return !!row && row.seq === seq && row.leaseOwner === TAB_ID;
}

/** Salió bien: se borra la fila y, si era un alta, se remapea su id. */
async function settleSuccess(
  claimed: OutboxRecord,
  outcome: DispatchOutcome,
  userId: string,
): Promise<void> {
  await withTx(
    [STORES.outbox, STORES.idMap, STORES.apiCache],
    'readwrite',
    async (tx) => {
      const store = tx.objectStore(STORES.outbox);
      const row = await req<OutboxRecord | undefined>(store.get(claimed.seq!));
      if (!stillOurs(row, claimed.seq!)) return;
      if (outcome.remap) {
        const { entity, tempId, serverId, created } = outcome.remap;
        await applyRemapInTx(tx, userId, entity, tempId, serverId, created);
      }
      store.delete(claimed.seq!);
    },
  );
  // Avisar aquí y no solo al final de la pasada no es un detalle: mientras la
  // fila siga en la bandeja, la pantalla pinta su copia optimista. Si nadie
  // avisa de que ya salió, esa copia se queda encima de la fila de verdad que
  // llega en el refresco — que es justo el duplicado que todo esto evita.
  emitOutboxChanged();
}

/** Puede funcionar más tarde: se apunta el intento y cuándo volver a probar. */
async function countAttempt(claimed: OutboxRecord, failure: ReplayFailure): Promise<void> {
  const attempts = claimed.attempts + 1;
  await withTx(STORES.outbox, 'readwrite', async (tx) => {
    const store = tx.objectStore(STORES.outbox);
    const row = await req<OutboxRecord | undefined>(store.get(claimed.seq!));
    if (!stillOurs(row, claimed.seq!)) return;
    store.put({
      ...row,
      status: 'pending',
      attempts,
      nextAttemptAt: nextAttemptAt(attempts, failure.retryAfterMs),
      lastError: `${failure.status ?? 'net'}: ${failure.detail ?? failure.code}`,
      leaseOwner: undefined,
      leaseUntil: undefined,
    });
  });
}

/** La sesión murió o no hay salida: se suelta la fila sin tocar nada más. */
async function release(claimed: OutboxRecord): Promise<void> {
  await withTx(STORES.outbox, 'readwrite', async (tx) => {
    const store = tx.objectStore(STORES.outbox);
    const row = await req<OutboxRecord | undefined>(store.get(claimed.seq!));
    if (!stillOurs(row, claimed.seq!)) return;
    store.put({ ...row, status: 'pending', leaseOwner: undefined, leaseUntil: undefined });
  });
}

/**
 * Aparta filas: salen del outbox y entran en la lista de fallidos EN LA MISMA
 * transacción.
 *
 * Es el invariante más importante de toda la fase: el trabajo de una docente no
 * puede existir en cero stores ni en dos. O se mueve entero, o no se mueve.
 */
async function moveToDeadLetter(
  rows: { row: OutboxRecord; reason: string }[],
  failedAt = Date.now(),
): Promise<void> {
  if (rows.length === 0) return;
  await withTx([STORES.outbox, STORES.deadLetter], 'readwrite', (tx) => {
    const outbox = tx.objectStore(STORES.outbox);
    const dead = tx.objectStore(STORES.deadLetter);
    for (const { row, reason } of rows) {
      const { seq, status: _status, leaseOwner: _o, leaseUntil: _u, ...rest } = row;
      void _status;
      void _o;
      void _u;
      dead.put({ ...rest, failedAt, reason } satisfies Omit<DeadLetterRecord, 'seq'>);
      if (seq !== undefined) outbox.delete(seq);
    }
  });
  emitOutboxChanged();
}

/**
 * Recupera las filas que quedaron en vuelo porque su pestaña murió a mitad de
 * despacho. No sabemos si el servidor las recibió: `resumePolicy` decide.
 */
async function reclaimAbandoned(userId: string): Promise<void> {
  const now = Date.now();
  const rows = (await listRows(userId)).filter(
    (r) => r.status === 'inflight' && (r.leaseUntil ?? 0) <= now,
  );
  if (rows.length === 0) return;
  await withTx(STORES.outbox, 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.outbox);
    for (const row of rows) {
      if (resumePolicy(row.kind) === 'drop') {
        if (row.seq !== undefined) store.delete(row.seq);
      } else {
        store.put({
          ...row,
          status: 'pending',
          attempts: row.attempts + 1,
          leaseOwner: undefined,
          leaseUntil: undefined,
        });
      }
    }
  });
}

/** Agrupa por cadena conservando el orden de llegada dentro de cada una. */
function groupChains(rows: OutboxRecord[]): OutboxRecord[][] {
  const chains = new Map<string, OutboxRecord[]>();
  for (const row of rows) {
    const chain = chains.get(row.chainKey);
    if (chain) chain.push(row);
    else chains.set(row.chainKey, [row]);
  }
  return [...chains.values()];
}

let running: Promise<PassResult> | null = null;

/**
 * Una pasada de reproducción.
 *
 * Recorre por turnos: un despacho por cadena y vuelta a empezar mientras haya
 * progreso. Drenando cadena a cadena, treinta comentarios encolados en una
 * publicación pondrían treinta viajes de red por delante de una edición de
 * perfil que la docente hizo después; por turnos, el retraso de cabecera se
 * queda en una petición por cadena y no cuesta ni una petición más — son las
 * mismas N en otro orden.
 *
 * Termina porque solo cuentan como progreso el éxito y la muerte, y ambos
 * borran su fila del outbox: cada vuelta con progreso deja estrictamente menos
 * filas.
 *
 * Una cadena atascada no detiene a las demás. El único estado que escribe un
 * fallo son los `attempts` y el `nextAttemptAt` de SU fila, y la elegibilidad
 * se mira cadena por cadena. Ese `return` ante el primer fallo transitorio que
 * tiene `mutation-queue.ts:443` es lo que convertía toda la cola en una sola
 * cadena global: la forma real de BUG-03, una edición de evento atascada
 * reteniendo de rehén a una de perfil durante horas.
 */
export function replayPass(): Promise<PassResult> {
  if (running) return running;
  running = runPass().finally(() => {
    running = null;
  });
  return running;
}

async function runPass(): Promise<PassResult> {
  if (!isIdbAvailable() || !isOnline()) {
    return { dispatched: 0, dead: 0, stopped: 'skipped' };
  }
  const userId = getCacheUser();
  const first = await listRows(userId);
  if (first.length === 0) {
    await refreshCounts();
    return { dispatched: 0, dead: 0, stopped: 'drained' };
  }

  // `withSync` envuelve la pasada ENTERA, nunca cada despacho: si no, el aviso
  // parpadearía una vez por petición. Y una pasada que no hace nada ni siquiera
  // entra aquí, para que no destelle por un no-op.
  return withSync(async () => {
    await reclaimAbandoned(userId);

    let dispatched = 0;
    let dead = 0;
    let sweeps = 0;
    let progress = true;

    while (progress && sweeps < MAX_SWEEPS) {
      progress = false;
      sweeps += 1;
      // Se relee en cada vuelta: lo encolado a mitad de pasada se ve en la
      // siguiente, y lo que se fundió no se despacha desde una foto vieja.
      const rows = await listRows(userId);
      if (rows.length === 0) break;

      for (const chain of groupChains(rows)) {
        const head = chain[0];
        if (head.seq === undefined) continue;

        const claimed = await claim(head.seq, userId);
        if (!claimed) continue;

        const mutation = toMutation(claimed);
        if (!mutation) {
          // Una fila que esta versión de la app ya no sabe leer. Se aparta sin
          // gastar una sola petición, con toda su cadena: si el payload es
          // ilegible, nada que dependa de él tiene sentido.
          await moveToDeadLetter(chain.map((row) => ({ row, reason: unreadableReason() })));
          dead += chain.length;
          progress = true;
          continue;
        }

        try {
          const outcome = await dispatch(mutation);
          await settleSuccess(claimed, outcome, userId);
          dispatched += 1;
          progress = true;
        } catch (error) {
          const failure = classifyReplayError(error, claimed.attempts + 1);

          if (failure.verdict === 'session') {
            // No se cuenta intento ni se escribe nada en la fila: tiene que
            // sobrevivir a la caducidad de la sesión para replicarse cuando la
            // docente vuelva a entrar.
            await release(claimed);
            await refreshCounts();
            // Y se avisa a quien es dueño de esa decisión. El outbox no purga
            // nada por su cuenta: `reportDeadSession` se lleva el contenido
            // cacheado —copia de lo que el servidor ya tiene— y deja en paz la
            // bandeja, que es la única copia de lo que todavía no tiene.
            void reportDeadSession(failure.detail);
            return { dispatched, dead, stopped: 'session' as const };
          }

          if (failure.verdict === 'unreachable') {
            // Un fallo de transporte no dice de quién es la culpa. `isOnline()`
            // da true con alcanzabilidad desconocida, así que una tablet
            // enganchada a un punto de acceso sin salida sí corre pasadas: si
            // esto contase intento, un aula sin internet mataría el trabajo de
            // la docente sin que ningún servidor lo hubiera rechazado.
            const reachable = await checkReachability(true);
            if (!reachable) {
              await release(claimed);
              await refreshCounts();
              return { dispatched, dead, stopped: 'unreachable' as const };
            }
            await countAttempt(claimed, failure);
            continue;
          }

          if (failure.verdict === 'retry') {
            await countAttempt(claimed, failure);
            continue; // su cadena queda fuera hasta que le toque
          }

          // Muerta. Si era la cabeza de una cadena que nace de un alta, o el
          // servidor dice que la entidad ya no existe, se lleva al resto: sin
          // id de servidor que mapear, lo que venga detrás solo produciría una
          // ristra de 404 contra algo que nunca existió.
          const cascades = failure.cascades || isCreate(claimed.kind);
          const victims = cascades ? chain : [claimed];
          await moveToDeadLetter(
            victims.map((row) => ({
              row,
              reason: row.seq === claimed.seq ? failure.reason : orphanReason(claimed.kind),
            })),
          );
          dead += victims.length;
          progress = true;
        }
      }
    }

    await refreshCounts();
    return { dispatched, dead, stopped: 'drained' as const };
  });
}

function isCreate(kind: string): boolean {
  return kind === 'post.create' || kind === 'event.create';
}

// ── lo que la docente decide sobre los fallidos ──────────────────────────────

/**
 * Devuelve un cambio apartado a la bandeja para volver a intentarlo.
 *
 * Los intentos vuelven a cero: es una decisión suya sobre algo que ya estaba
 * muerto, no un reintento automático más. Es el único sitio donde `attempts` se
 * reinicia; en cualquier otro, hacerlo dejaría mantener vivo un cambio imposible
 * para siempre.
 */
export async function retryDeadLetter(seq: number): Promise<void> {
  if (!isIdbAvailable()) return;
  const userId = getCacheUser();
  await withTx([STORES.outbox, STORES.deadLetter], 'readwrite', async (tx) => {
    const deadStore = tx.objectStore(STORES.deadLetter);
    const row = await req<DeadLetterRecord | undefined>(deadStore.get(seq));
    if (!row || row.userId !== userId) return;
    const { seq: _seq, failedAt: _failedAt, reason: _reason, ...rest } = row;
    void _seq;
    void _failedAt;
    void _reason;
    tx.objectStore(STORES.outbox).put({
      ...rest,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
      lastError: undefined,
    } satisfies Omit<OutboxRecord, 'seq'>);
    deadStore.delete(seq);
  });
  await refreshCounts();
  emitOutboxChanged();
}

/** Descartar: se borra de la tablet y no se envía. No hay vuelta atrás. */
export async function discardDeadLetter(seq: number): Promise<void> {
  if (!isIdbAvailable()) return;
  const userId = getCacheUser();
  await withTx(STORES.deadLetter, 'readwrite', async (tx) => {
    const store = tx.objectStore(STORES.deadLetter);
    const row = await req<DeadLetterRecord | undefined>(store.get(seq));
    if (!row || row.userId !== userId) return;
    store.delete(seq);
  });
  await refreshCounts();
  emitOutboxChanged();
}

/** Lo mismo, para todos los de la usuaria actual. */
export async function discardAllDeadLetters(): Promise<void> {
  if (!isIdbAvailable()) return;
  const rows = await listDeadRows();
  if (rows.length === 0) return;
  await withTx(STORES.deadLetter, 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.deadLetter);
    for (const row of rows) if (row.seq !== undefined) store.delete(row.seq);
  });
  await refreshCounts();
  emitOutboxChanged();
}

/** El instante más cercano en que algo vuelve a poder salir; `null` si no hay nada. */
export async function nextDueAt(): Promise<number | null> {
  const rows = await listRows();
  if (rows.length === 0) return null;
  return Math.min(...rows.map((r) => r.nextAttemptAt));
}

/**
 * Vuelve la conexión o la app al primer plano: todo puede reintentarse ya.
 *
 * Se reinicia `nextAttemptAt`, NUNCA `attempts`. Reiniciar los intentos dejaría
 * mantener vivo un cambio imposible para siempre a base de modo avión.
 */
export async function resetBackoff(): Promise<void> {
  if (!isIdbAvailable()) return;
  const userId = getCacheUser();
  const rows = (await listRows(userId)).filter((r) => r.nextAttemptAt > 0);
  if (rows.length === 0) return;
  await withTx(STORES.outbox, 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.outbox);
    for (const row of rows) store.put({ ...row, nextAttemptAt: 0 });
  });
}

/**
 * Limpieza por antigüedad: lo que lleva demasiado sin poder salir se aparta
 * —para que la docente lo vea y decida— y lo apartado hace mucho se borra.
 *
 * Es la contrapartida de que el trabajo sin sincronizar sobreviva a cerrar
 * sesión: sobrevive, pero no indefinidamente.
 */
export async function sweepStale(now: number = Date.now()): Promise<void> {
  if (!isIdbAvailable()) return;
  const userId = getCacheUser();

  const stale = (await listRows(userId)).filter((r) => now - r.createdAt > OUTBOX_TTL_MS);
  await moveToDeadLetter(stale.map((row) => ({ row, reason: staleReason() })), now);

  const rotten = (await listDeadRows(userId)).filter(
    (r) => now - r.failedAt > DEAD_LETTER_TTL_MS,
  );
  if (rotten.length > 0) {
    await withTx(STORES.deadLetter, 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.deadLetter);
      for (const row of rotten) if (row.seq !== undefined) store.delete(row.seq);
    });
  }
  if (stale.length > 0 || rotten.length > 0) {
    await refreshCounts();
    emitOutboxChanged();
  }
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

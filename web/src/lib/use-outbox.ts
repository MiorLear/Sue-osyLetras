import { useSyncExternalStore } from 'react';

import type { DeadLetterRecord } from '@/lib/idb';
import {
  listDeadRows,
  listPending,
  subscribeOutbox,
  type PendingMutation,
} from '@/lib/outbox';

// La proyección de la bandeja que consumen las pantallas.
//
// Existe porque una pantalla no puede preguntarle a IndexedDB "¿esta fila está
// encolada?" en cada render: es asíncrono y son decenas de filas por lista. El
// índice se reconstruye UNA vez por cambio y se cachea; `getSnapshot` devuelve
// esa misma referencia, cosa que no es un detalle — devolver un objeto nuevo
// mete a `useSyncExternalStore` en un bucle infinito de renders.
//
// La regla que gobierna todo el pintado optimista de las pantallas se apoya en
// esto: una fila optimista se pinta si, y solo si, su cambio sigue en la
// bandeja. Así "reconcilia sin duplicar" es cierto por construcción, y no por
// acordarse de limpiar un estado local en el momento justo.

export interface PendingIndex {
  count: number;
  /** Ids provisionales de publicaciones todavía en cola. */
  posts: ReadonlySet<number>;
  /** Publicaciones con una reacción en cola. */
  likes: ReadonlySet<number>;
  /** Publicaciones con al menos un comentario en cola. */
  comments: ReadonlySet<number>;
  /** Eventos (provisionales o reales) con un alta o una edición en cola. */
  events: ReadonlySet<string>;
  /** Eventos con un borrado en cola. */
  eventsRemoved: ReadonlySet<string>;
  /** Hay una edición de perfil en cola. */
  profile: boolean;
}

const EMPTY: PendingIndex = {
  count: 0,
  posts: new Set(),
  likes: new Set(),
  comments: new Set(),
  events: new Set(),
  eventsRemoved: new Set(),
  profile: false,
};

/** Puro: se prueba sin base de datos. */
export function buildIndex(pending: PendingMutation[]): PendingIndex {
  const posts = new Set<number>();
  const likes = new Set<number>();
  const comments = new Set<number>();
  const events = new Set<string>();
  const eventsRemoved = new Set<string>();
  let profile = false;

  for (const { mutation } of pending) {
    switch (mutation.kind) {
      case 'profile.update':
        profile = true;
        break;
      case 'post.create':
        posts.add(mutation.tempId);
        break;
      case 'post.like':
        likes.add(mutation.postId);
        break;
      case 'post.comment':
        comments.add(mutation.postId);
        break;
      case 'event.create':
        events.add(mutation.tempId);
        break;
      case 'event.update':
        events.add(mutation.targetId);
        break;
      case 'event.remove':
        eventsRemoved.add(mutation.targetId);
        break;
    }
  }
  return { count: pending.length, posts, likes, comments, events, eventsRemoved, profile };
}

let index: PendingIndex = EMPTY;
let deadLetters: readonly DeadLetterRecord[] = [];
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;

function emit(): void {
  for (const l of listeners) l();
}

/** Relee ambos stores y publica el resultado. Nunca reentra en el outbox. */
export async function refreshOutboxView(): Promise<void> {
  const [pending, dead] = await Promise.all([listPending(), listDeadRows()]);
  index = buildIndex(pending);
  deadLetters = dead;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!unsubscribe) {
    unsubscribe = subscribeOutbox(() => void refreshOutboxView());
    void refreshOutboxView();
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      unsubscribe?.();
      unsubscribe = null;
    }
  };
}

const getIndex = (): PendingIndex => index;
const getDeadLetters = (): readonly DeadLetterRecord[] => deadLetters;

/** Qué está esperando a salir, para marcarlo en pantalla. */
export function usePendingIndex(): PendingIndex {
  return useSyncExternalStore(subscribe, getIndex, getIndex);
}

/** Los cambios que ya no se van a reintentar solos. */
export function useDeadLetters(): readonly DeadLetterRecord[] {
  return useSyncExternalStore(subscribe, getDeadLetters, getDeadLetters);
}

/** Solo para tests. */
export function __resetOutboxView(): void {
  index = EMPTY;
  deadLetters = [];
  listeners.clear();
  unsubscribe?.();
  unsubscribe = null;
}

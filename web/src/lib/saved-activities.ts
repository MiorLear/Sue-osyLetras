import { useSyncExternalStore } from 'react';

import { cacheKeys } from './cache-keys';
import { readCache, writeCache } from './offline-cache';

/**
 * "Mis recursos": las actividades que una docente guarda para volver después.
 *
 * El documento de estructura lo pide como un bloque del Inicio ("lo que la
 * docente ha guardado para volver después"), así que tiene que sobrevivir a
 * recargar la página. Se guarda por `offline-cache`, no por `localStorage`
 * suelto, por dos razones: las entradas quedan bajo el namespace de la usuaria
 * —en una tablet compartida, la segunda docente no ve lo de la primera— y
 * `clearUserEverything()` ya las borra al cerrar sesión sin tocar nada aquí.
 *
 * La copia en memoria existe porque la tarjeta necesita responder "¿está
 * guardada?" mientras se pinta, y la caché es asíncrona.
 */
export interface SavedActivity {
  /** `${emotionId}::${title}` — estable mientras el CMS no renombre la actividad. */
  id: string;
  title: string;
  purpose: string;
  emotionId: string;
  emotionName: string;
  emoji: string;
  /** Epoch ms, para listar lo último guardado primero. */
  savedAt: number;
}

let items: SavedActivity[] = [];
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Id estable de una actividad dentro de su emoción. */
export function activityId(emotionId: string, title: string): string {
  return `${emotionId}::${title}`;
}

/**
 * Lee lo guardado una sola vez por sesión. Si la caché falla —modo privado,
 * almacenamiento bloqueado— se sigue con la lista vacía: guardar deja de
 * persistir, pero la pantalla no se rompe.
 */
function hydrate(): Promise<void> {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const stored = await readCache<SavedActivity[]>(cacheKeys.savedActivities());
      if (stored?.length && items.length === 0) {
        items = stored;
        emit();
      }
    } catch {
      /* sin almacenamiento utilizable; se sigue en memoria */
    }
  })();
  return hydrating;
}

function persist() {
  void writeCache(cacheKeys.savedActivities(), items).catch(() => {
    /* lo mismo: la sesión conserva la lista aunque el disco no */
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void hydrate();
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return items;
}

/** Guarda o quita una actividad. Devuelve si quedó guardada. */
export function toggleSavedActivity(activity: Omit<SavedActivity, 'savedAt'>): boolean {
  const existing = items.some((i) => i.id === activity.id);
  items = existing
    ? items.filter((i) => i.id !== activity.id)
    : [{ ...activity, savedAt: Date.now() }, ...items];
  emit();
  persist();
  return !existing;
}

/** Lo guardado, lo último primero. */
export function useSavedActivities(): SavedActivity[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useIsActivitySaved(id: string): boolean {
  const saved = useSavedActivities();
  return saved.some((i) => i.id === id);
}

/**
 * Olvida lo guardado en memoria. `clearUserEverything()` ya vacía la caché al
 * cerrar sesión; esto evita que la lista de la docente anterior siga pintada
 * hasta que alguien recargue.
 */
export function clearSavedActivities() {
  items = [];
  hydrating = null;
  emit();
}

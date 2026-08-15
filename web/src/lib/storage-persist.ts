import { readMetaValue, writeMetaValue } from '@/lib/app-meta';

// Almacenamiento persistente: pedirle al navegador que no borre lo que la
// docente descargó a propósito.
//
// Sin esto, el navegador considera desechable todo lo que guardamos y lo tira
// cuando necesita espacio. En iOS es peor y más concreto: Safari borra TODO el
// almacenamiento del origen tras 7 días sin visitas si el sitio no está en la
// pantalla de inicio. Una docente que se va de vacaciones vuelve a una caché
// vacía, y no hay API que lo evite — Safari ignora `navigator.storage.persist()`
// por completo. Ahí la única mitigación real es instalar la app, que es lo que
// explica el banner de InstallPrompt.

/** Ranura con el resultado de la última petición. */
const PERSIST_KEY = 'storage.persisted';

export interface PersistOutcome {
  /** Si el navegador concedió persistencia. */
  granted: boolean;
  /** False cuando el navegador no implementa la API (Safari, entre otros). */
  supported: boolean;
  at: number;
}

function api(): StorageManager | null {
  if (typeof navigator === 'undefined' || !navigator.storage) return null;
  return navigator.storage;
}

/**
 * Pide almacenamiento persistente y deja anotado qué respondió.
 *
 * Se llama después del login: antes de saber quién es la usuaria no hay
 * contenido suyo que valga la pena proteger, y un permiso pedido demasiado
 * pronto es un permiso que se deniega.
 *
 * Nunca lanza: es una mejora, no un requisito para usar la app.
 */
export async function requestPersistentStorage(): Promise<PersistOutcome> {
  const storage = api();

  if (!storage || typeof storage.persist !== 'function') {
    const outcome: PersistOutcome = { granted: false, supported: false, at: Date.now() };
    await writeMetaValue(PERSIST_KEY, outcome);
    return outcome;
  }

  try {
    // Si ya está concedido no se vuelve a pedir: en algunos navegadores cada
    // petición es un aviso más para la usuaria.
    const already = typeof storage.persisted === 'function' ? await storage.persisted() : false;
    const granted = already || (await storage.persist());
    const outcome: PersistOutcome = { granted, supported: true, at: Date.now() };
    await writeMetaValue(PERSIST_KEY, outcome);
    return outcome;
  } catch {
    const outcome: PersistOutcome = { granted: false, supported: true, at: Date.now() };
    await writeMetaValue(PERSIST_KEY, outcome);
    return outcome;
  }
}

/** Lo que respondió la última vez, sin volver a preguntar. */
export async function lastPersistOutcome(): Promise<PersistOutcome | undefined> {
  return readMetaValue<PersistOutcome>(PERSIST_KEY);
}

export interface StorageUsage {
  /** Bytes que el navegador dice que ocupa este origen. */
  usage?: number;
  /** Bytes que le concede como máximo. */
  quota?: number;
  /** False donde `storage.estimate()` no existe. */
  supported: boolean;
}

/** Cuánto ocupa la app y cuánto le deja el navegador. */
export async function storageUsage(): Promise<StorageUsage> {
  const storage = api();
  if (!storage || typeof storage.estimate !== 'function') return { supported: false };
  try {
    const { usage, quota } = await storage.estimate();
    return { usage, quota, supported: true };
  } catch {
    return { supported: false };
  }
}

/**
 * Fracción de la cuota que la app se permite ocupar.
 *
 * Pasarse no da un error: el navegador empieza a desalojar, y lo primero que
 * cae puede ser el contenido que la docente bajó para la clase de mañana. Es
 * mejor negarse antes y decir por qué.
 */
export const SAFE_QUOTA_FRACTION = 0.8;

/** Si cabe bajar `bytes` más sin pasar de la fracción segura de la cuota. */
export function fitsInQuota(bytes: number, usage: StorageUsage): boolean {
  if (!usage.supported || !usage.quota) return true; // sin dato, no se bloquea
  return (usage.usage ?? 0) + bytes <= usage.quota * SAFE_QUOTA_FRACTION;
}

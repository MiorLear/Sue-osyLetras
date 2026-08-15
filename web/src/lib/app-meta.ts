import { STORES, getRecord, isIdbAvailable, putRecord, scopedKey, type MetaRecord } from '@/lib/idb';
import { getCacheUser } from '@/lib/offline-cache';

// Ranuras pequeñas de estado: cuándo corrió la última sincronización, qué
// respondió navigator.storage.persist(), y lo que venga.
//
// Van al store `meta` de IndexedDB y no a localStorage por dos razones. Están
// scoped por usuaria como todo lo demás —una tablet de aula la comparten varias
// docentes y la marca de sincronización de una no vale para la siguiente— y
// localStorage es sincrónico, así que escribir ahí en cada reconexión bloquea
// el hilo principal justo cuando la app está ocupada revalidando.

/** Lee una ranura. `undefined` si no está o si IndexedDB no se puede usar. */
export async function readMetaValue<T>(name: string): Promise<T | undefined> {
  if (!isIdbAvailable()) return undefined;
  try {
    const userId = getCacheUser();
    const row = await getRecord<MetaRecord>(STORES.meta, scopedKey(userId, name));
    // Defensivo: una fila solo se alcanza por la clave de su propia usuaria,
    // pero nunca se sirve una cuyo dueño registrado no coincida.
    if (!row || row.userId !== userId) return undefined;
    return row.value as T;
  } catch {
    return undefined;
  }
}

/** Escribe una ranura. Best-effort: esto nunca puede romper a quien lo llama. */
export async function writeMetaValue(name: string, value: unknown): Promise<void> {
  if (!isIdbAvailable()) return;
  try {
    const userId = getCacheUser();
    const record: MetaRecord = {
      id: scopedKey(userId, name),
      userId,
      name,
      value,
      updatedAt: Date.now(),
    };
    await putRecord(STORES.meta, record);
  } catch {
    /* cuota, clon o conexión: no es asunto de quien llamó */
  }
}

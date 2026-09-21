import type { LearningProgressEntry, SubTopic } from '@explorarte/shared';

// El avance por el mapa de fases, sin React y sin IndexedDB.
//
// La regla que gobierna el pintado es la que ya documenta `use-outbox.ts`: una
// fila optimista se pinta si, y solo si, su cambio sigue en la bandeja. Aquí se
// traduce a una sola función —`effectiveProgress`— que superpone lo pendiente
// sobre lo que dice el servidor.
//
// Sin esa superposición aparecería un fallo sutil y difícil de reproducir: la
// docente desmarca una fase sin conexión, la sincronización de contenido trae
// un GET rancio del servidor que todavía la da por completada, y la fase se
// vuelve a marcar sola delante de ella.

/** La clave con la que una fase se identifica en todas partes. */
export function progressId(topicId: string, stepKey: string): string {
  return `${topicId}::${stepKey}`;
}

/**
 * Lo que hay que pintar: la verdad del servidor, con lo pendiente encima.
 *
 * `pending` viene de `usePendingIndex().learningSteps` y solo tiene las fases
 * con un cambio sin enviar; para el resto manda el servidor.
 */
export function effectiveProgress(
  server: LearningProgressEntry[] | null | undefined,
  pending: ReadonlyMap<string, boolean>,
): ReadonlySet<string> {
  const done = new Set<string>();
  for (const entry of server ?? []) done.add(progressId(entry.topicId, entry.stepKey));
  for (const [id, completed] of pending) {
    if (completed) done.add(id);
    else done.delete(id);
  }
  return done;
}

/**
 * Cuántas fases del tema están completadas, contando solo las que el tema
 * tiene HOY.
 *
 * Si la administradora borra una fase, su fila sigue en el servidor —a
 * propósito, para que vuelva si la fase vuelve— y sin este cruce el contador
 * diría "4 de 3".
 */
export function completedCount(steps: SubTopic[], topicId: string, done: ReadonlySet<string>): number {
  return steps.filter((s) => done.has(progressId(topicId, s.key))).length;
}

/**
 * En qué fase va: la primera sin completar.
 *
 * Se mide en seguidas desde el principio, no en total. Si alguien salta a la
 * fase 3 y la marca, la que "sigue" es la 1, que es la que no ha hecho.
 */
export function currentStepIndex(steps: SubTopic[], topicId: string, done: ReadonlySet<string>): number {
  const i = steps.findIndex((s) => !done.has(progressId(topicId, s.key)));
  // Todas hechas: la actual es la última, para que el mapa no señale al vacío.
  return i === -1 ? Math.max(0, steps.length - 1) : i;
}

export type StepState = 'completed' | 'current' | 'locked';

/**
 * Cómo se dibuja un nodo del mapa.
 *
 * `locked` es solo aspecto: la fase se puede abrir igual. Esto es formación
 * docente, no un juego con recompensas, y además sin conexión el bloqueo sería
 * falso —el PUT que desbloquearía la siguiente está esperando en la bandeja—.
 */
export function stepState(index: number, current: number, isDone: boolean): StepState {
  if (isDone) return 'completed';
  return index === current ? 'current' : 'locked';
}

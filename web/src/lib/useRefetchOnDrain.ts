import { useEffect, useRef } from 'react';

import { usePendingCount } from '@/lib/sync-status';

/**
 * Vuelve a pedir la lista cuando la bandeja termina de vaciarse.
 *
 * Es la costura entre lo optimista y lo real: mientras hay cambios en cola la
 * pantalla pinta una copia local, y en cuanto la cola llega a cero lo que manda
 * es el servidor.
 *
 * Se compara con el conteo ANTERIOR y no con `pending === 0` a secas porque
 * cero es el estado normal: sin la comparación, cada pantalla volvería a pedir
 * la lista en cada render.
 *
 * Lo que no distingue, y no pasa nada: la cola también llega a cero cuando el
 * último cambio se aparta en vez de enviarse. Refrescar entonces es inofensivo
 * —el servidor no tiene nada nuevo— y de que la docente se entere se encarga el
 * aviso de cambios sin enviar, no este hook.
 *
 * Puerto del `useRef` que la app RN repite en `comunidad.tsx` y `calendar.tsx`.
 */
export function useRefetchOnDrain(reload: () => void): void {
  const pending = usePendingCount();
  const previous = useRef(pending);

  useEffect(() => {
    if (previous.current > 0 && pending === 0) reload();
    previous.current = pending;
  }, [pending, reload]);
}

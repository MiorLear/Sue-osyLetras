import { useEffect, useRef } from 'react';

import { maybeSyncContent } from '@/lib/content-sync';
import { useIsOnline } from '@/lib/useNetworkStatus';

/**
 * Dispara la precarga de contenido: al entrar y cada vez que vuelve la
 * conexión.
 *
 * Se monta en el layout autenticado (`TabsLayout`) y no en `main.tsx` a
 * propósito: en `main.tsx` correría también en la pantalla de login, y precargar
 * el contenido de una docente antes de saber quién es la deja escrito en el
 * ámbito anónimo de la caché, donde ninguna pantalla lo va a buscar después.
 *
 * Solo dispara en la transición de offline a online, no en cada render con
 * `online === true`. La propia `maybeSyncContent` ya se protege con su ventana
 * de 15 minutos, pero una tablet que salta entre wifi y datos móviles cambia
 * esa bandera muchas veces por minuto y no tiene sentido despertar a IndexedDB
 * en cada salto solo para que diga que no.
 */
export function useContentSync(): void {
  const online = useIsOnline();
  const wasOnline = useRef<boolean | null>(null);

  useEffect(() => {
    const first = wasOnline.current === null;
    const reconnected = wasOnline.current === false && online;
    wasOnline.current = online;

    if (!online) return;
    if (!first && !reconnected) return;

    // Nunca revienta la pantalla: la precarga es una mejora, y lo que la
    // usuaria esté leyendo ya se sirvió de la caché.
    void maybeSyncContent().catch(() => undefined);
  }, [online]);
}

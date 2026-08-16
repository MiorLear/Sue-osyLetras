import { useEffect, useState } from 'react';
import type { CalEvent, Post } from '@explorarte/shared';

import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { confirmDialog } from '@/components/confirm-store';
import { toast } from '@/components/toast-store';
import { cacheKeys } from '@/lib/cache-keys';
import type { DeadLetterRecord } from '@/lib/idb';
import { readCache } from '@/lib/offline-cache';
import { discardAllDeadLetters, discardDeadLetter, retryDeadLetter } from '@/lib/outbox';
import { describeAttempts, describeRecord, type Lookup } from '@/lib/sync-problem-text';
import { useDeadLetters } from '@/lib/use-outbox';
import { useIsOnline } from '@/lib/useNetworkStatus';
import { formatCacheAge } from '@/lib/useOfflineAsync';

// Los cambios que el servidor no aceptó y que ya no se van a reintentar solos.
//
// Sin esta pantalla, apartarlos sería solo una forma silenciosa de perderlos: el
// aviso de arriba seguiría prometiendo que todo se sincroniza y la docente no
// tendría manera de enterarse, ni de decidir. Por eso el ticket que crea la
// lista de fallidos y el que la enseña van juntos.

export default function SyncProblemas() {
  const rows = useDeadLetters();
  const online = useIsOnline();
  const [lookup, setLookup] = useState<Lookup>({});

  // Los borrados y los "me gusta" solo guardan un id, así que el título sale de
  // lo que ya está en la tablet. Es lectura pura: si no hay nada, cada fila cae
  // en su texto genérico y no pasa nada.
  useEffect(() => {
    let active = true;
    void (async () => {
      const [events, posts] = await Promise.all([
        readCache<CalEvent[]>(cacheKeys.events()),
        readCache<Post[]>(cacheKeys.posts(undefined)),
      ]);
      if (active) setLookup({ events: events ?? [], posts: posts ?? [] });
    })();
    return () => {
      active = false;
    };
  }, []);

  const reintentar = async (row: DeadLetterRecord) => {
    if (row.seq === undefined) return;
    await retryDeadLetter(row.seq);
    // Sin conexión también se reencola: el sentido de la bandeja es justamente
    // aceptar el cambio ahora y enviarlo luego.
    toast.success(
      online ? 'Lo estamos volviendo a intentar.' : 'Lo intentaremos en cuanto haya conexión.',
    );
  };

  const descartar = async (row: DeadLetterRecord) => {
    if (row.seq === undefined) return;
    const ok = await confirmDialog({
      title: '¿Descartar este cambio?',
      message: 'Se borrará de esta tablet y no se enviará. No hay forma de recuperarlo.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Conservar',
      tone: 'danger',
    });
    if (!ok) return;
    await discardDeadLetter(row.seq);
    toast.success('Cambio descartado.');
  };

  const descartarTodo = async () => {
    const ok = await confirmDialog({
      title: `¿Descartar los ${rows.length} cambios?`,
      message: 'Se borrarán de esta tablet y no se enviarán. No hay forma de recuperarlos.',
      confirmLabel: 'Descartar todo',
      cancelLabel: 'Conservar',
      tone: 'danger',
    });
    if (!ok) return;
    await discardAllDeadLetters();
    toast.success('Cambios descartados.');
  };

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Sincronización"
        title="Cambios"
        accent="sin enviar"
        lede="Estos cambios se guardaron en la tablet pero el servidor no los aceptó. Revisa cada uno y decide si vuelves a intentarlo o lo descartas."
        showDate={false}
      />

      {rows.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
          Todo se guardó. No hay cambios pendientes de revisar.
        </p>
      ) : (
        <>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, listStyle: 'none' }}>
            {rows.map((row) => {
              const { title, detail } = describeRecord(row, lookup);
              const age = formatCacheAge(Math.max(0, Date.now() - row.failedAt));
              return (
                <li
                  key={row.seq}
                  style={{ padding: 16, borderRadius: 16, background: '#fff', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{title}</div>
                  {detail ? (
                    <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--text-body)' }}>{detail}</div>
                  ) : null}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="x" size={14} color="var(--danger)" />
                    <span style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{row.reason}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-faint)' }}>
                    {describeAttempts(row, age)}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => reintentar(row)}
                      aria-label={`Reintentar: ${title}`}
                      style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1.5px solid var(--brand)', background: '#fff', color: 'var(--brand)', fontSize: 13, fontWeight: 700 }}>
                      Reintentar
                    </button>
                    <button
                      onClick={() => descartar(row)}
                      aria-label={`Descartar: ${title}`}
                      style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1.5px solid #FEB2B2', background: '#FFF5F5', color: '#C53030', fontSize: 13, fontWeight: 700 }}>
                      Descartar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {rows.length > 1 ? (
            <button
              onClick={descartarTodo}
              style={{ marginTop: 16, minHeight: 44, width: '100%', borderRadius: 12, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>
              Descartar todo
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

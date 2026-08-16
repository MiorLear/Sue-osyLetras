import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let online = true;
vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => online,
  isOnline: () => online,
  checkReachability: async () => online,
  subscribeNetwork: () => () => undefined,
}));

import SyncProblemas from '@/routes/SyncProblemas';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toaster } from '@/components/Toaster';
import { clearToasts } from '@/components/toast-store';
import { cacheKeys } from '@/lib/cache-keys';
import {
  STORES,
  clearEverything,
  getAllByUser,
  putRecord,
  type DeadLetterRecord,
} from '@/lib/idb';
import { setCacheUser, writeCache } from '@/lib/offline-cache';
import { __resetOutbox, listPending } from '@/lib/outbox';
import { __resetSyncStatus } from '@/lib/sync-status';
import { __resetOutboxView, refreshOutboxView } from '@/lib/use-outbox';

// Sin esta pantalla, apartar un cambio sería solo una forma silenciosa de
// perderlo. Lo que se prueba: que la docente entienda qué pasó y pueda decidir.

const ANA = 'ana';

const fallida = (over: Partial<DeadLetterRecord> = {}): Omit<DeadLetterRecord, 'seq'> => ({
  id: 'm-1',
  userId: ANA,
  kind: 'post.comment',
  payload: { postId: 7, input: { text: 'qué buena idea' } },
  chainKey: 'post:7',
  createdAt: Date.now() - 60_000,
  attempts: 3,
  nextAttemptAt: 0,
  failedAt: Date.now() - 2 * 60 * 60_000,
  reason: 'El contenido ya no existe.',
  ...over,
});

const view = () =>
  render(
    <MemoryRouter>
      <SyncProblemas />
      <Toaster />
      <ConfirmDialog />
    </MemoryRouter>,
  );

const deadRows = () => getAllByUser<DeadLetterRecord>(STORES.deadLetter, ANA);

beforeEach(async () => {
  vi.clearAllMocks();
  online = true;
  await clearEverything();
  __resetOutbox();
  __resetOutboxView();
  __resetSyncStatus();
  clearToasts();
  setCacheUser(ANA);
});

afterEach(cleanup);

describe('<SyncProblemas /> · la lista', () => {
  it('cuando no hay nada, lo dice', async () => {
    view();
    expect(await screen.findByText(/Todo se guardó/)).toBeTruthy();
  });

  it('cuenta qué era, por qué falló y cuántas veces se intentó', async () => {
    await putRecord(STORES.deadLetter, fallida());
    view();

    expect(await screen.findByText('Comentario: «qué buena idea»')).toBeTruthy();
    expect(screen.getByText('El contenido ya no existe.')).toBeTruthy();
    expect(screen.getByText(/3 intentos/)).toBeTruthy();
  });

  it('pone nombre a los cambios que solo guardan un id', async () => {
    await writeCache(cacheKeys.events(), [{ id: 'e-1', title: 'Sesión con 3.º grado' }]);
    await putRecord(
      STORES.deadLetter,
      fallida({ kind: 'event.remove', payload: { targetId: 'e-1' }, chainKey: 'event:e-1' }),
    );
    view();

    expect(await screen.findByText('Eliminar el evento «Sesión con 3.º grado»')).toBeTruthy();
  });
});

describe('<SyncProblemas /> · reintentar', () => {
  it('devuelve el cambio a la bandeja con los intentos a cero', async () => {
    await putRecord(STORES.deadLetter, fallida());
    view();
    fireEvent.click(await screen.findByLabelText(/^Reintentar:/));

    await waitFor(async () => {
      const pending = await listPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].attempts).toBe(0);
    });
    await expect(deadRows()).resolves.toEqual([]);
  });

  it('sin conexión también acepta el reintento, y lo dice', async () => {
    online = false;
    await putRecord(STORES.deadLetter, fallida());
    view();
    fireEvent.click(await screen.findByLabelText(/^Reintentar:/));

    expect(await screen.findByText(/en cuanto haya conexión/)).toBeTruthy();
  });
});

describe('<SyncProblemas /> · descartar', () => {
  it('pide confirmación y no borra nada si se conserva', async () => {
    await putRecord(STORES.deadLetter, fallida());
    view();
    fireEvent.click(await screen.findByLabelText(/^Descartar:/));

    fireEvent.click(await screen.findByText('Conservar'));

    await waitFor(async () => expect(await deadRows()).toHaveLength(1));
  });

  it('borra al confirmar', async () => {
    await putRecord(STORES.deadLetter, fallida());
    view();
    fireEvent.click(await screen.findByLabelText(/^Descartar:/));
    // El de dentro del diálogo: "Descartar" también es el de la fila.
    fireEvent.click(
      await screen.findByText('Descartar', { selector: '.confirm-dialog__confirm' }),
    );

    await waitFor(async () => expect(await deadRows()).toEqual([]));
  });

  it('enfoca la acción segura, no la irreversible', async () => {
    // El diálogo enfocaba el botón de confirmar con un comentario que decía lo
    // contrario. Aquí eso convertiría un Intro de más en un borrado sin vuelta.
    await putRecord(STORES.deadLetter, fallida());
    view();
    fireEvent.click(await screen.findByLabelText(/^Descartar:/));

    await waitFor(() => expect(document.activeElement?.textContent).toBe('Conservar'));
  });

  it('descartar todo aparece solo cuando hay más de uno', async () => {
    await putRecord(STORES.deadLetter, fallida({ id: 'm-1' }));
    view();
    await screen.findByText('Comentario: «qué buena idea»');
    expect(screen.queryByText('Descartar todo')).toBeNull();

    await putRecord(STORES.deadLetter, fallida({ id: 'm-2' }));
    await refreshOutboxView();

    expect(await screen.findByText('Descartar todo')).toBeTruthy();
  });
});

describe('<SyncProblemas /> · ámbito por usuaria', () => {
  it('no enseña los cambios fallidos de otra docente de la tablet', async () => {
    await putRecord(STORES.deadLetter, fallida({ userId: 'bea', id: 'm-bea' }));
    view();

    expect(await screen.findByText(/Todo se guardó/)).toBeTruthy();
  });
});

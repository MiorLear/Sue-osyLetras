import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  events: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api }));

let online = true;
vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => online,
  isOnline: () => online,
  checkReachability: async () => online,
  subscribeNetwork: () => () => undefined,
}));

import CalendarScreen from '@/routes/Calendar';
import { Toaster } from '@/components/Toaster';
import { clearToasts } from '@/components/toast-store';
import { cacheKeys } from '@/lib/cache-keys';
import { clearEverything } from '@/lib/idb';
import { setCacheUser, writeCache } from '@/lib/offline-cache';
import { __resetOutbox, listPending } from '@/lib/outbox';
import { __resetSyncStatus } from '@/lib/sync-status';
import { __resetOutboxView } from '@/lib/use-outbox';

const HOY = new Date();
const iso = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, '0')}-${String(HOY.getDate()).padStart(2, '0')}`;

const EVENTO = {
  id: 'e-1',
  title: 'Sesión con 3.º',
  type: 'tarea' as const,
  date: iso,
  startTime: '10:00',
  endTime: '11:00',
  reminder: 'ninguno',
  completed: false,
};

const view = () =>
  render(
    <MemoryRouter>
      <CalendarScreen />
      <Toaster />
    </MemoryRouter>,
  );

/** Rellena el formulario del modal abierto y guarda. */
async function rellenarYGuardar(title: string, submitLabel = 'Guardar evento') {
  fireEvent.change(await screen.findByPlaceholderText('Nombre del evento'), {
    target: { value: title },
  });
  fireEvent.click(screen.getByText(submitLabel));
}

beforeEach(async () => {
  vi.clearAllMocks();
  online = true;
  await clearEverything();
  __resetOutbox();
  __resetOutboxView();
  __resetSyncStatus();
  clearToasts();
  setCacheUser('ana');
  await writeCache(cacheKeys.events(), [EVENTO]);
  api.events.list.mockResolvedValue([EVENTO]);
  api.events.create.mockResolvedValue({ ...EVENTO, id: 'e-99' });
  api.events.update.mockResolvedValue({ ...EVENTO, completed: true });
  api.events.remove.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('<Calendar /> · sin conexión', () => {
  it('crea un evento, lo pinta marcado y no llama a la API', async () => {
    online = false;
    view();
    await screen.findByText('Sesión con 3.º');

    fireEvent.click(screen.getByText('Nuevo evento'));
    await rellenarYGuardar('Reunión de ciclo');

    expect(await screen.findByText('Sin enviar')).toBeTruthy();
    expect(screen.getByText('Reunión de ciclo')).toBeTruthy();
    expect(api.events.create).not.toHaveBeenCalled();
    await waitFor(async () => expect(await listPending()).toHaveLength(1));
  });

  it('marcar una tarea sin red la encola', async () => {
    online = false;
    view();
    await screen.findByText('Sesión con 3.º');

    fireEvent.click(screen.getByLabelText('Marcar como completada: Sesión con 3.º'));

    await waitFor(async () => expect(await listPending()).toHaveLength(1));
    expect(api.events.update).not.toHaveBeenCalled();
    expect(await screen.findByLabelText('Marcar como pendiente: Sesión con 3.º')).toBeTruthy();
  });

  it('marcar y desmarcar deja un solo cambio, con el valor final', async () => {
    online = false;
    view();
    await screen.findByText('Sesión con 3.º');

    fireEvent.click(screen.getByLabelText('Marcar como completada: Sesión con 3.º'));
    await screen.findByLabelText('Marcar como pendiente: Sesión con 3.º');
    fireEvent.click(screen.getByLabelText('Marcar como pendiente: Sesión con 3.º'));

    await waitFor(async () => {
      const pending = await listPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].mutation).toMatchObject({ input: { completed: false } });
    });
  });

  it('borrar un evento sin red lo esconde y lo encola', async () => {
    online = false;
    view();
    fireEvent.click(await screen.findByText('Sesión con 3.º'));
    fireEvent.click(await screen.findByText('Eliminar'));
    fireEvent.click(screen.getAllByText('Eliminar').at(-1)!);

    await waitFor(async () => expect(await listPending()).toHaveLength(1));
    expect(api.events.remove).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Sesión con 3.º')).toBeNull());
  });
});

describe('<Calendar /> · un evento que todavía no existe en el servidor', () => {
  it('editarlo no llama a la API aunque haya conexión', async () => {
    // Su id es provisional: la API no lo conoce. La edición pasa por la cola y
    // el outbox reescribe el objetivo cuando el alta aterriza.
    online = false;
    view();
    await screen.findByText('Sesión con 3.º');
    fireEvent.click(screen.getByText('Nuevo evento'));
    await rellenarYGuardar('Recién creada');
    await screen.findByText('Recién creada');

    online = true;
    fireEvent.click(screen.getByText('Recién creada'));
    fireEvent.click(await screen.findByText('Editar'));
    await rellenarYGuardar('Recién creada y corregida', 'Guardar cambios');

    await waitFor(() => expect(screen.getByText('Recién creada y corregida')).toBeTruthy());
    expect(api.events.update).not.toHaveBeenCalled();
  });

  it('borrarlo cancela su alta en vez de encolar un borrado', async () => {
    online = false;
    view();
    await screen.findByText('Sesión con 3.º');
    fireEvent.click(screen.getByText('Nuevo evento'));
    await rellenarYGuardar('Me arrepentí');
    await screen.findByText('Me arrepentí');

    fireEvent.click(screen.getByText('Me arrepentí'));
    fireEvent.click(await screen.findByText('Eliminar'));
    fireEvent.click(screen.getAllByText('Eliminar').at(-1)!);

    // Ni alta ni borrado: al servidor no llega nada, que es lo que ella quiso.
    await waitFor(async () => expect(await listPending()).toEqual([]));
  });
});

describe('<Calendar /> · con conexión sigue yendo directo', () => {
  it('crea contra la API y no deja nada en la bandeja', async () => {
    view();
    await screen.findByText('Sesión con 3.º');

    fireEvent.click(screen.getByText('Nuevo evento'));
    await rellenarYGuardar('Con red');

    await waitFor(() => expect(api.events.create).toHaveBeenCalledTimes(1));
    expect(await listPending()).toEqual([]);
  });
});

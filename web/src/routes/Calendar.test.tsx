import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '@explorarte/shared';
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

const dialogo = () => screen.getByRole('dialog');

async function abrirFormulario() {
  fireEvent.click(await screen.findByText('Nuevo evento'));
  return dialogo();
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
    fireEvent.click(within(dialogo()).getByText('Eliminar'));
    fireEvent.click(within(dialogo()).getByText('Eliminar'));

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
    fireEvent.click(within(dialogo()).getByText('Eliminar'));
    fireEvent.click(within(dialogo()).getByText('Eliminar'));

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

describe('<Calendar /> · formulario', () => {
  it('usa selectores nativos de fecha y hora', async () => {
    view();
    const modal = await abrirFormulario();

    expect(within(modal).getByLabelText('Fecha')).toHaveProperty('type', 'date');
    expect(within(modal).getByLabelText('Inicio')).toHaveProperty('type', 'time');
    expect(within(modal).getByLabelText('Fin')).toHaveProperty('type', 'time');
    expect(within(modal).getByLabelText('Título')).toHaveProperty('placeholder', 'Nombre del evento');
    expect(within(modal).getByLabelText('Tipo')).toHaveProperty('tagName', 'SELECT');
  });

  it('acepta 9:00 → 10:00 aunque la hora inicial no tenga cero', async () => {
    const temprano = { ...EVENTO, startTime: '9:00', endTime: '10:00' };
    await writeCache(cacheKeys.events(), [temprano]);
    api.events.list.mockResolvedValueOnce([temprano]);
    api.events.update.mockResolvedValueOnce(temprano);
    view();
    fireEvent.click(await screen.findByText('Sesión con 3.º'));
    fireEvent.click(within(dialogo()).getByText('Editar'));
    expect(within(dialogo()).getByLabelText('Inicio')).toHaveProperty('value', '09:00');
    expect(within(dialogo()).getByLabelText('Fin')).toHaveProperty('value', '10:00');
    fireEvent.click(within(dialogo()).getByText('Guardar cambios'));

    await waitFor(() => expect(api.events.update).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('La hora de fin debe ser posterior a la hora de inicio')).toBeNull();
  });

  it('rechaza una hora final igual o anterior a la inicial', async () => {
    view();
    const modal = await abrirFormulario();
    fireEvent.change(within(modal).getByPlaceholderText('Nombre del evento'), { target: { value: 'Rango imposible' } });
    fireEvent.change(within(modal).getByLabelText('Fin'), { target: { value: '09:30' } });
    fireEvent.click(within(modal).getByText('Guardar evento'));

    expect(await screen.findByText('La hora de fin debe ser posterior a la hora de inicio')).toBeTruthy();
    expect(api.events.create).not.toHaveBeenCalled();
    expect(await listPending()).toEqual([]);
  });

  it('rechaza un título vacío sin llamar a la API ni al outbox', async () => {
    view();
    const modal = await abrirFormulario();
    fireEvent.click(within(modal).getByText('Guardar evento'));

    expect(await screen.findByText('Por favor ingresa un título')).toBeTruthy();
    expect(api.events.create).not.toHaveBeenCalled();
    expect(await listPending()).toEqual([]);
  });

  it('conserva fecha y horas válidas si el navegador emite un valor vacío', async () => {
    view();
    const modal = await abrirFormulario();
    const fecha = within(modal).getByLabelText('Fecha') as HTMLInputElement;
    const inicio = within(modal).getByLabelText('Inicio') as HTMLInputElement;
    const fin = within(modal).getByLabelText('Fin') as HTMLInputElement;
    const valores = [fecha.value, inicio.value, fin.value];

    for (const campo of [fecha, inicio, fin]) fireEvent.change(campo, { target: { value: '' } });

    expect([fecha.value, inicio.value, fin.value]).toEqual(valores);
  });

  it('no encola un rechazo de sesión del servidor', async () => {
    api.events.create.mockRejectedValueOnce(new ApiError(403, 'Sesión terminada'));
    view();
    await abrirFormulario();
    await rellenarYGuardar('No debe quedar pendiente');

    await waitFor(() => expect(api.events.create).toHaveBeenCalledTimes(1));
    expect(await listPending()).toEqual([]);
  });
});

describe('<Calendar /> · diálogo accesible', () => {
  it('se anuncia como modal y enfoca el título al crear', async () => {
    view();
    const modal = await abrirFormulario();

    expect(modal.getAttribute('aria-modal')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(within(modal).getByLabelText('Título')));
  });

  it('encierra Tab y Shift+Tab dentro del diálogo', async () => {
    view();
    const modal = await abrirFormulario();
    const primero = within(modal).getByLabelText('Cerrar modal');
    const ultimo = within(modal).getByText('Guardar evento');

    ultimo.focus();
    fireEvent.keyDown(modal, { key: 'Tab' });
    expect(document.activeElement).toBe(primero);

    primero.focus();
    fireEvent.keyDown(modal, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
  });

  it('Escape cierra creación y devuelve el foco a Nuevo evento', async () => {
    view();
    const trigger = await screen.findByText('Nuevo evento');
    const modal = await abrirFormulario();
    fireEvent.keyDown(modal, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape cierra edición y devuelve el foco a Editar', async () => {
    view();
    fireEvent.click(await screen.findByText('Sesión con 3.º'));
    const editar = within(dialogo()).getByText('Editar');
    fireEvent.click(editar);
    const modal = dialogo();
    fireEvent.keyDown(modal, { key: 'Escape' });

    const editarRestaurado = within(dialogo()).getByText('Editar');
    await waitFor(() => expect(document.activeElement).toBe(editarRestaurado));
  });
});

describe('<Calendar /> · vistas y estados', () => {
  it('cambia entre día, semana y mes', async () => {
    view();
    await screen.findByText('Sesión con 3.º');
    expect(screen.getByText('7:00 AM')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    expect(screen.getByText(/No hay eventos para este día|Sesión con 3.º/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Semana' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getByRole('button', { name: /1 evento/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mes' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('la rejilla mensual expone fecha, selección y cantidad de eventos', async () => {
    view();
    await screen.findByText('Sesión con 3.º');
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));

    const hoy = screen.getByRole('button', { name: /1 evento/ });
    expect(hoy.getAttribute('aria-current')).toBe('date');
    expect(hoy.getAttribute('aria-pressed')).toBe('true');
  });

  it('explica el estado vacío sin ocultar las vistas', async () => {
    await writeCache(cacheKeys.events(), []);
    api.events.list.mockResolvedValueOnce([]);
    view();

    expect(await screen.findByText('Aún no tienes eventos. Crea uno con “Nuevo evento”.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Día' })).toBeTruthy();
  });
});

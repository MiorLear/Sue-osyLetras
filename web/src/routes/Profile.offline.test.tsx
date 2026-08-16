import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Guardar el perfil sin conexión, con TODO el ecosistema montado: el módulo de
// red de verdad (no mockeado) y el planificador de replay corriendo, que es lo
// que hay en la app real y lo que `Profile.test.tsx` no tiene.
//
// Se escribió para reproducir un fallo encontrado probando en un navegador: la
// app decía "Guardado sin conexión" y el cambio no aparecía por ninguna parte.

const api = vi.hoisted(() => ({
  profile: { get: vi.fn(), update: vi.fn() },
  media: { upload: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api }));

const setUser = vi.hoisted(() => vi.fn());
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ setUser, signOut: vi.fn() }) }));
vi.mock('@/lib/useSchools', () => ({ useSchools: () => ['Colegio Americano'] }));

import Profile from '@/routes/Profile';
import { Toaster } from '@/components/Toaster';
import { clearToasts } from '@/components/toast-store';
import { cacheKeys } from '@/lib/cache-keys';
import { clearEverything } from '@/lib/idb';
import { readCache, setCacheUser, writeCache } from '@/lib/offline-cache';
import { __resetOutbox, listPending } from '@/lib/outbox';
import { __resetScheduler, startOutboxScheduler } from '@/lib/outbox-scheduler';
import { __resetSyncStatus } from '@/lib/sync-status';
import { __resetNetworkStatus, isOnline } from '@/lib/useNetworkStatus';
import { __resetOutboxView } from '@/lib/use-outbox';

const PERFIL = {
  id: 'u-maria',
  name: 'María Reneé',
  lastname: 'García López',
  email: 'maria@ejemplo.com',
  phone: '+503 7000 1234',
  institucion: 'Colegio Americano',
  ubicacion: 'San Salvador',
  photo: null,
  role: 'teacher' as const,
};

let stop: (() => void) | null = null;

beforeEach(async () => {
  vi.clearAllMocks();
  await clearEverything();
  __resetOutbox();
  __resetOutboxView();
  __resetSyncStatus();
  __resetNetworkStatus();
  __resetScheduler();
  clearToasts();
  setCacheUser('u-maria');
  await writeCache(cacheKeys.profile(), PERFIL);
  api.profile.get.mockResolvedValue(PERFIL);
  api.profile.update.mockImplementation(async (input: Record<string, unknown>) => ({
    ...PERFIL,
    ...input,
  }));
});

afterEach(() => {
  stop?.();
  stop = null;
  __resetScheduler();
  cleanup();
});

describe('Perfil sin conexión, con el replay montado', () => {
  it('guardar deja el cambio en la bandeja y no lo revierte en pantalla', async () => {
    // El planificador es lo que la app monta en TabsLayout. Aquí va aparte
    // porque el test renderiza la pantalla suelta.
    const handle = startOutboxScheduler();
    stop = handle.stop;

    render(
      <MemoryRouter>
        <Profile />
        <Toaster />
      </MemoryRouter>,
    );

    const nombre = await screen.findByDisplayValue('María Reneé');
    fireEvent.change(nombre, { target: { value: 'María Reneé Offline' } });

    // Sin conexión, tal cual lo simula la prueba manual: el evento sintético.
    // `navigator.onLine` sigue en true y eso es correcto — el estado de la app
    // no depende de esa bandera.
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    // El aviso de arriba ya lo refleja: a partir de aquí la app se sabe sin red.
    await waitFor(() => expect(isOnline()).toBe(false));

    // Antes de guardar: lo que la docente escribió tiene que seguir escrito.
    expect((nombre as HTMLInputElement).value).toBe('María Reneé Offline');

    fireEvent.click(screen.getByText('Guardar cambios'));

    // Lo que la app le promete a la docente.
    expect(await screen.findByText(/se enviarán cuando haya conexión/i)).toBeTruthy();

    // Y lo que tiene que ser verdad para que esa promesa no sea mentira.
    await waitFor(async () => expect(await listPending()).toHaveLength(1));
    expect(api.profile.update).not.toHaveBeenCalled();

    // Un respiro para que cualquier pasada de replay en vuelo haga su trabajo.
    await new Promise((r) => setTimeout(r, 250));

    expect(await listPending()).toHaveLength(1);
    expect((await readCache<typeof PERFIL>(cacheKeys.profile()))?.name).toBe(
      'María Reneé Offline',
    );
    expect((screen.getByDisplayValue(/María Reneé/) as HTMLInputElement).value).toBe(
      'María Reneé Offline',
    );
  });

  it('al reconectar, el cambio sale y el formulario vuelve a mandarlo el servidor', async () => {
    // La otra mitad: el freno que impide que el espejo pise lo escrito no se
    // puede quedar puesto para siempre, o el perfil dejaría de reflejar lo que
    // haya cambiado desde otro dispositivo.
    const handle = startOutboxScheduler();
    stop = handle.stop;

    render(
      <MemoryRouter>
        <Profile />
        <Toaster />
      </MemoryRouter>,
    );

    const nombre = await screen.findByDisplayValue('María Reneé');
    fireEvent.change(nombre, { target: { value: 'María Reneé Offline' } });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await waitFor(() => expect(isOnline()).toBe(false));
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(async () => expect(await listPending()).toHaveLength(1));

    // Vuelve la conexión: el planificador drena la bandeja.
    api.profile.get.mockResolvedValue({ ...PERFIL, name: 'María Reneé Offline' });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(async () => expect(await listPending()).toEqual([]), { timeout: 3000 });
    expect(api.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'María Reneé Offline' }),
    );
    // Y en pantalla sigue lo suyo, ahora ya confirmado por el servidor.
    await waitFor(() =>
      expect((screen.getByDisplayValue(/María Reneé/) as HTMLInputElement).value).toBe(
        'María Reneé Offline',
      ),
    );
  });
});

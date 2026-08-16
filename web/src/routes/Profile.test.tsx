import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  profile: { get: vi.fn(), update: vi.fn() },
  media: { upload: vi.fn() },
  schools: { list: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api }));

let online = true;
vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => online,
  isOnline: () => online,
  checkReachability: async () => online,
  subscribeNetwork: () => () => undefined,
}));

const setUser = vi.hoisted(() => vi.fn());
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ setUser, signOut: vi.fn() }),
}));

vi.mock('@/lib/useSchools', () => ({ useSchools: () => ['Colegio Americano'] }));

import Profile from '@/routes/Profile';
import { Toaster } from '@/components/Toaster';
import { clearToasts } from '@/components/toast-store';
import { cacheKeys } from '@/lib/cache-keys';
import { clearEverything } from '@/lib/idb';
import { readCache, setCacheUser, writeCache } from '@/lib/offline-cache';
import { __resetOutbox, listPending } from '@/lib/outbox';
import { __resetSyncStatus } from '@/lib/sync-status';
import { __resetOutboxView } from '@/lib/use-outbox';

const PERFIL = {
  id: 'ana',
  name: 'Ana',
  lastname: 'Ruiz',
  email: 'ana@ejemplo.com',
  phone: '+503 7000 1234',
  institucion: 'Colegio Americano',
  ubicacion: 'San Salvador',
  photo: null,
  role: 'teacher' as const,
};

const view = () =>
  render(
    <MemoryRouter>
      <Profile />
      <Toaster />
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.clearAllMocks();
  online = true;
  await clearEverything();
  __resetOutbox();
  __resetOutboxView();
  __resetSyncStatus();
  clearToasts();
  setCacheUser('ana');
  await writeCache(cacheKeys.profile(), PERFIL);
  api.profile.get.mockResolvedValue(PERFIL);
  api.profile.update.mockResolvedValue({ ...PERFIL, name: 'Ana María' });
});

afterEach(cleanup);

describe('<Profile /> · guardar sin conexión', () => {
  it('encola los campos de texto y no promete que se guardó', async () => {
    online = false;
    view();
    const nombre = await screen.findByDisplayValue('Ana');

    fireEvent.change(nombre, { target: { value: 'Ana María' } });
    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(async () => expect(await listPending()).toHaveLength(1));
    expect(api.profile.update).not.toHaveBeenCalled();
    // El verde diría "Perfil actualizado correctamente", que sería mentira
    // mientras el cambio siga en la bandeja.
    expect(screen.queryByText('Perfil actualizado correctamente')).toBeNull();
    expect(await screen.findByText(/se enviarán cuando haya conexión/i)).toBeTruthy();
  });

  it('deja la caché al día para que recargar sin red no revive lo viejo', async () => {
    online = false;
    view();
    fireEvent.change(await screen.findByDisplayValue('Ana'), { target: { value: 'Ana María' } });
    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(async () => {
      const cached = await readCache<typeof PERFIL>(cacheKeys.profile());
      expect(cached?.name).toBe('Ana María');
    });
  });

  it('mantiene al día la cabecera de la app', async () => {
    online = false;
    view();
    fireEvent.change(await screen.findByDisplayValue('Ana'), { target: { value: 'Ana María' } });
    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana María' })));
  });

  it('la foto necesita red, y se dice', async () => {
    online = false;
    view();
    await screen.findByDisplayValue('Ana');

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'yo.png', { type: 'image/png' })] },
    });

    expect(await screen.findByText(/necesita conexión para subirse/i)).toBeTruthy();
    expect(api.media.upload).not.toHaveBeenCalled();
  });
});

describe('<Profile /> · con conexión sigue yendo directo', () => {
  it('guarda contra la API y enseña el visto bueno', async () => {
    view();
    fireEvent.change(await screen.findByDisplayValue('Ana'), { target: { value: 'Ana María' } });
    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(() => expect(api.profile.update).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Perfil actualizado correctamente')).toBeTruthy();
    expect(await listPending()).toEqual([]);
  });
});

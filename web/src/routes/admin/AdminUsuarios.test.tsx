import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserProfile } from '@explorarte/shared';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toaster } from '@/components/Toaster';
import { clearToasts } from '@/components/toast-store';

const api = vi.hoisted(() => ({
  admin: {
    users: {
      list: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
      promote: vi.fn(),
      remove: vi.fn(),
    },
  },
}));
vi.mock('@/lib/api', () => ({ api }));

import AdminUsuarios from './AdminUsuarios';

function docente(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    name: 'Ana',
    lastname: 'Pérez',
    email: 'ana@ejemplo.com',
    phone: '',
    institucion: 'Sueños y Letras',
    ubicacion: 'Tegucigalpa',
    role: 'teacher',
    status: 'approved',
    ...over,
  };
}

function view() {
  render(
    <MemoryRouter>
      <AdminUsuarios />
      <ConfirmDialog />
      <Toaster />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  clearToasts();
  api.admin.users.list.mockResolvedValue([docente()]);
  api.admin.users.promote.mockResolvedValue(docente({ role: 'admin' }));
});

afterEach(cleanup);

describe('AdminUsuarios — promover a administradora', () => {
  it('pregunta antes y, al confirmar, promueve y saca a la usuaria del directorio', async () => {
    view();

    fireEvent.click(await screen.findByRole('button', { name: 'Hacer administradora a Ana' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hacer administradora' }));

    await waitFor(() => expect(api.admin.users.promote).toHaveBeenCalledWith('u-1'));
    expect(await screen.findByText('Ana ahora es administradora.')).toBeTruthy();
    expect(screen.queryByText('Ana Pérez')).toBeNull();
  });

  it('no hace nada si se cancela', async () => {
    view();

    fireEvent.click(await screen.findByRole('button', { name: 'Hacer administradora a Ana' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(api.admin.users.promote).not.toHaveBeenCalled());
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
  });

  // El API responde 409 a una cuenta sin acceso: ofrecer el botón prometería
  // algo que el servidor rechaza.
  it('una cuenta sin acceso no ofrece promover', async () => {
    api.admin.users.list.mockResolvedValue([docente({ status: 'rejected' })]);
    view();

    fireEvent.click(await screen.findByRole('button', { name: 'Todas' }));
    await screen.findByText('Ana Pérez');
    expect(screen.queryByRole('button', { name: 'Hacer administradora a Ana' })).toBeNull();
  });

  it('si el servidor falla, avisa y la deja en la lista', async () => {
    api.admin.users.promote.mockRejectedValue(new Error('boom'));
    view();

    fireEvent.click(await screen.findByRole('button', { name: 'Hacer administradora a Ana' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hacer administradora' }));

    expect(await screen.findByText('No se pudo hacer administradora. Intenta de nuevo.')).toBeTruthy();
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
  });
});

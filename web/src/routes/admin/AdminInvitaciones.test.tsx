import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Invitation } from '@explorarte/shared';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toaster } from '@/components/Toaster';
import { clearToasts } from '@/components/toast-store';

// vi.hoisted porque vi.mock sube al principio del fichero: sin esto, la fábrica
// del mock se ejecuta antes de que exista el const y falla al inicializar.
const api = vi.hoisted(() => ({
  admin: {
    invitations: {
      list: vi.fn(),
      create: vi.fn(),
      resend: vi.fn(),
      revoke: vi.fn(),
    },
  },
}));
vi.mock('@/lib/api', () => ({ api }));

import AdminInvitaciones from './AdminInvitaciones';

const DIA = 24 * 60 * 60 * 1000;

function invitacion(over: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    email: 'docente@ejemplo.com',
    status: 'pending',
    createdAt: new Date('2026-09-01T10:00:00Z').toISOString(),
    expiresAt: new Date(Date.now() + 14 * DIA).toISOString(),
    acceptedAt: null,
    ...over,
  };
}

function view() {
  render(
    <MemoryRouter>
      <AdminInvitaciones />
      <ConfirmDialog />
      <Toaster />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  clearToasts();
  api.admin.invitations.list.mockResolvedValue([]);
  api.admin.invitations.create.mockResolvedValue(invitacion());
  api.admin.invitations.resend.mockResolvedValue(invitacion());
  api.admin.invitations.revoke.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('<AdminInvitaciones />', () => {
  it('envía la invitación y vacía el campo', async () => {
    view();
    fireEvent.change(await screen.findByLabelText('Correo de la docente'), {
      target: { value: 'nueva@ejemplo.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    await waitFor(() => expect(api.admin.invitations.create).toHaveBeenCalledWith('nueva@ejemplo.com'));
    await waitFor(() =>
      expect((screen.getByLabelText('Correo de la docente') as HTMLInputElement).value).toBe(''),
    );
  });

  // El 400 del servidor llegaría dos pantallas más tarde; comprobarlo aquí evita
  // un viaje de ida y vuelta para decir algo que se ve desde el propio campo.
  it('un correo mal escrito no llega a salir', async () => {
    view();
    fireEvent.change(await screen.findByLabelText('Correo de la docente'), {
      target: { value: 'no-es-un-correo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    expect(await screen.findByText(/correo electrónico válido/i)).toBeTruthy();
    expect(api.admin.invitations.create).not.toHaveBeenCalled();
  });

  it('el mensaje del servidor se muestra tal cual cuando lo hay', async () => {
    const { ApiError } = await import('@explorarte/shared');
    api.admin.invitations.create.mockRejectedValue(
      new ApiError(409, 'conflict', JSON.stringify({ detail: 'Ya existe una cuenta con ese correo' })),
    );
    view();
    fireEvent.change(await screen.findByLabelText('Correo de la docente'), {
      target: { value: 'repetida@ejemplo.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    expect(await screen.findByText('Ya existe una cuenta con ese correo')).toBeTruthy();
  });

  it('una invitación pendiente se puede reenviar', async () => {
    api.admin.invitations.list.mockResolvedValue([invitacion()]);
    view();

    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar' }));

    await waitFor(() => expect(api.admin.invitations.resend).toHaveBeenCalledWith('inv-1'));
  });

  it('revocar pregunta antes, y no hace nada si se cancela', async () => {
    api.admin.invitations.list.mockResolvedValue([invitacion()]);
    view();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Revocar la invitación de docente@ejemplo.com' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(api.admin.invitations.revoke).not.toHaveBeenCalled());
  });

  // Una invitación aceptada ya no tiene enlace vivo: ofrecer reenviarla o
  // revocarla prometería un efecto que el servidor rechaza con un 409.
  it('una invitación aceptada no ofrece reenviar ni revocar', async () => {
    api.admin.invitations.list.mockResolvedValue([
      invitacion({ status: 'accepted', acceptedAt: new Date('2026-09-05T10:00:00Z').toISOString() }),
    ]);
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Todas' }));

    expect(await screen.findByText('Aceptada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reenviar' })).toBeNull();
  });

  it('el filtro por defecto deja fuera lo que ya no está pendiente', async () => {
    api.admin.invitations.list.mockResolvedValue([
      invitacion({ id: 'inv-1', email: 'pendiente@ejemplo.com' }),
      invitacion({ id: 'inv-2', email: 'vencida@ejemplo.com', status: 'expired' }),
    ]);
    view();

    expect(await screen.findByText('pendiente@ejemplo.com')).toBeTruthy();
    expect(screen.queryByText('vencida@ejemplo.com')).toBeNull();
  });
});

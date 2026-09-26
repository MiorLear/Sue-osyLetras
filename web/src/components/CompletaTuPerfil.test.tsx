import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserProfile } from '@explorarte/shared';

const auth = vi.hoisted(() => ({ value: {} as { authed: boolean; user: UserProfile | null } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth.value }));

const meta = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/app-meta', () => ({
  readMetaValue: (...args: unknown[]) => meta.read(...args),
  writeMetaValue: (...args: unknown[]) => meta.write(...args),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-router-dom')>();
  return { ...real, useNavigate: () => navigate };
});

import { CompletaTuPerfil } from './CompletaTuPerfil';

function docente(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    name: 'Usuario',
    lastname: '',
    email: 'invitada@ejemplo.com',
    phone: '',
    institucion: 'Sueños y Letras',
    ubicacion: '',
    role: 'teacher',
    status: 'approved',
    photo: null,
    profileCompleted: false,
    ...over,
  };
}

function view() {
  render(
    <MemoryRouter>
      <CompletaTuPerfil />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  meta.read.mockResolvedValue(undefined);
  meta.write.mockResolvedValue(undefined);
  auth.value = { authed: true, user: docente() };
});

afterEach(cleanup);

describe('<CompletaTuPerfil />', () => {
  it('la primera vez sale el modal de bienvenida', async () => {
    view();

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Bienvenida a ExplorArte')).toBeTruthy();
  });

  it('"Completar mi perfil" lleva al perfil y deja la marca puesta', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Completar mi perfil' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/profile'));
    expect(meta.write).toHaveBeenCalledWith('profile.welcome.seen', true);
  });

  // Un modal que reaparece en cada visita se cierra sin mirarlo; la franja
  // recuerda lo mismo sin interrumpir.
  it('tras cerrarlo queda la franja, no el modal', async () => {
    meta.read.mockResolvedValue(true);
    view();

    expect(await screen.findByText('Te falta completar tu perfil.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Más tarde" cambia el modal por la franja sin navegar', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Más tarde' }));

    expect(await screen.findByText('Te falta completar tu perfil.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  // Quien manda es el servidor: la marca local solo decide modal o franja.
  it('con el perfil ya completo no sale nada, aunque no haya marca local', async () => {
    auth.value = { authed: true, user: docente({ profileCompleted: true }) };
    view();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('Te falta completar tu perfil.')).toBeNull();
  });

  it('sin sesión no sale nada', async () => {
    auth.value = { authed: false, user: null };
    view();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  // Las cuentas que ya existían llegan sin el campo: la API lo añadió después.
  // Tratar ese hueco como "incompleto" les enseñaría el aviso a todas.
  it('una cuenta antigua sin el campo no recibe el aviso', async () => {
    const { profileCompleted: _omitido, ...sinCampo } = docente();
    auth.value = { authed: true, user: sinCampo as UserProfile };
    view();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('Te falta completar tu perfil.')).toBeNull();
  });
});

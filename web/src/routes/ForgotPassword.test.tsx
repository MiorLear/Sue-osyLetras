import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api';
import ForgotPassword from './ForgotPassword';

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    },
  },
}));

beforeEach(() => {
  window.history.replaceState({}, '', '/forgot-password');
  vi.mocked(api.auth.forgotPassword).mockReset().mockResolvedValue({ sent: true });
  vi.mocked(api.auth.resetPassword).mockReset().mockResolvedValue({ sent: true });
});

afterEach(cleanup);

describe('<ForgotPassword />', () => {
  it('solicita el enlace por correo sin revelar si la cuenta existe', async () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'maestra@ejemplo.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    await waitFor(() => {
      expect(api.auth.forgotPassword).toHaveBeenCalledWith('maestra@ejemplo.com');
    });
    expect(await screen.findByText('Revisa tu correo')).toBeTruthy();
    expect(screen.getByText(/Si existe una cuenta asociada/)).toBeTruthy();
  });

  it('abre el formulario desde el enlace y guarda la nueva contraseña', async () => {
    window.history.replaceState(
      {},
      '',
      '/forgot-password?email=maestra%40ejemplo.com&code=123456',
    );
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'NuevaClave123' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'NuevaClave123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() => {
      expect(api.auth.resetPassword).toHaveBeenCalledWith(
        'maestra@ejemplo.com',
        '123456',
        'NuevaClave123',
      );
    });
    expect(await screen.findByText('¡Contraseña actualizada!')).toBeTruthy();
  });
});

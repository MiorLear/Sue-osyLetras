import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import ForgotPassword from './ForgotPassword';

afterEach(cleanup);

describe('<ForgotPassword />', () => {
  it('expone cuál método de recuperación está activo', () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    const correo = screen.getByRole('button', { name: 'Por correo' });
    const telefono = screen.getByRole('button', { name: 'Por teléfono' });
    expect(correo.getAttribute('aria-pressed')).toBe('true');
    expect(telefono.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(telefono);
    expect(correo.getAttribute('aria-pressed')).toBe('false');
    expect(telefono.getAttribute('aria-pressed')).toBe('true');
  });
});

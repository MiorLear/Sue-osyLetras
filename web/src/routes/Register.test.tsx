import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@explorarte/shared';

// El último botón del alta no tenía .catch, así que cualquier rechazo del
// servidor —correo repetido, contraseña corta— era una promesa rechazada sin
// capturar: no pasaba nada y no se decía nada. Estos casos son los tres
// rechazos que de verdad se dan, y lo que se comprueba es que se vean.

// vi.hoisted porque vi.mock sube al principio del fichero: sin esto, la fábrica
// del mock se ejecuta antes de que exista el const y falla al inicializar.
const api = vi.hoisted(() => ({ auth: { register: vi.fn(), firebase: vi.fn() } }));
vi.mock('@/lib/api', () => ({ api }));

const signIn = vi.hoisted(() => vi.fn());
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ signIn }) }));

vi.mock('@/lib/useSchools', () => ({ useSchools: () => ['Colegio San Francisco'] }));

// Institución es un combo que además permite dar de alta una nueva, y ubicación
// un autocompletado que busca contra un servicio de lugares. Los dos hacen
// falta para que "Crear cuenta" se habilite, y ninguno es lo que se prueba
// aquí; cada uno tiene los suyos. El resto de `ui` va sin tocar, que incluye el
// ErrorNote que estos casos comprueban.
vi.mock('@/components/ui', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/ui')>();
  const campo = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  );
  return { ...real, SelectOrAdd: campo, LocationAutocomplete: campo };
});

const firebase = vi.hoisted(() => ({
  startGoogleSignIn: vi.fn(),
  finishGoogleSignIn: vi.fn(),
  requestPhoneCode: vi.fn(),
  confirmPhoneCode: vi.fn(),
}));
vi.mock('@/lib/firebase-auth', () => firebase);

vi.mock('@/lib/sw-activate', () => ({
  activateWaitingServiceWorker: vi.fn().mockResolvedValue(undefined),
  refreshServiceWorkerForAuthScreen: vi.fn().mockResolvedValue(undefined),
}));

import Register from './Register';

/** Deja la pantalla en el paso 3, que es donde vive "Crear cuenta". */
function llegarAlUltimoPaso(password = 'unaClaveLarga') {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByText('Correo y contraseña'));
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'maestra@ejemplo.com' },
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'María' } });
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'García' } });
  fireEvent.change(screen.getByLabelText('Institución'), { target: { value: 'Colegio San Francisco' } });
  fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'San Salvador' } });
}

beforeEach(() => {
  api.auth.register.mockReset();
  api.auth.firebase.mockReset();
  signIn.mockReset();
  firebase.startGoogleSignIn.mockReset();
  // Lo normal en cada carga: no hay ninguna redirección esperando.
  firebase.finishGoogleSignIn.mockReset().mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('<Register /> · el paso del correo', () => {
  it('no deja avanzar con una contraseña corta, y dice por qué', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Correo y contraseña'));
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'maestra@ejemplo.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: '123' } });

    // Antes el botón se habilitaba y el rechazo llegaba dos pantallas después,
    // donde ya no se ve el campo de la contraseña.
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveProperty('disabled', true);
    expect(screen.getByText(/al menos 8 caracteres/)).toBeTruthy();
  });

  it('avisa cuando las dos contraseñas no coinciden', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Correo y contraseña'));
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'unaClaveLarga' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'otraClave' } });

    expect(screen.getByText('Las dos contraseñas no coinciden.')).toBeTruthy();
  });
});

describe('<Register /> · cuando el servidor rechaza el alta', () => {
  it('un correo ya registrado se dice, y devuelve al paso donde se corrige', async () => {
    api.auth.register.mockRejectedValue(
      new ApiError(409, 'POST /auth/register failed: 409', '{"detail":"Ya existe una cuenta con ese correo"}'),
    );
    llegarAlUltimoPaso();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('Ya existe una cuenta con ese correo');
    // De vuelta en el paso 1: el correo que hay que cambiar vuelve a estar delante.
    expect(await screen.findByLabelText('Correo electrónico')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('un 400 enseña el mensaje del campo que manda la API, no uno genérico', async () => {
    api.auth.register.mockRejectedValue(
      new ApiError(
        400,
        'POST /auth/register failed: 400',
        '{"detail":"The request body is not valid","errors":{"password":"La contraseña debe tener al menos 8 caracteres"}}',
      ),
    );
    llegarAlUltimoPaso();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('La contraseña debe tener al menos 8 caracteres');
  });

  it('un fallo de red no se queda mudo', async () => {
    api.auth.register.mockRejectedValue(new TypeError('Failed to fetch'));
    llegarAlUltimoPaso();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('Revisa tu conexión');
    // Sin paso 1 al que volver por un fallo de red: el correo no es el problema.
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeTruthy();
  });

  it('el alta correcta entra a la app', async () => {
    api.auth.register.mockResolvedValue({ token: 't', user: { id: 'u-1' } });
    llegarAlUltimoPaso();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

/**
 * La vuelta de una redirección de Google.
 *
 * En un navegador embebido —abrir el enlace desde WhatsApp— el popup no se
 * puede abrir, así que la pestaña se va a Google y vuelve con la página
 * recargada de cero. Lo que se prueba aquí es que el alta continúa donde la
 * habría dejado el popup, y no en la pantalla de elegir método.
 */
describe('<Register /> · al volver de Google', () => {
  it('sigue en el paso de los datos personales, no en el de elegir método', async () => {
    firebase.finishGoogleSignIn.mockResolvedValue('token-de-google');

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    // El paso 3 pide quién es; el token ya está resuelto y no se vuelve a pedir.
    expect(await screen.findByLabelText('Nombre')).toBeTruthy();
    expect(screen.queryByText('Correo y contraseña')).toBeNull();
  });

  it('el alta usa el token de la redirección, no el registro por correo', async () => {
    firebase.finishGoogleSignIn.mockResolvedValue('token-de-google');
    api.auth.firebase.mockResolvedValue({ token: 't', user: { id: 'u-1' } });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'María' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'García' } });
    fireEvent.change(screen.getByLabelText('Institución'), { target: { value: 'Colegio San Francisco' } });
    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'San Salvador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(api.auth.firebase).toHaveBeenCalled());
    expect(api.auth.firebase.mock.calls[0][0]).toMatchObject({
      idToken: 'token-de-google',
      name: 'María',
      institucion: 'Colegio San Francisco',
    });
    expect(api.auth.register).not.toHaveBeenCalled();
  });

  it('un fallo al volver se dice, y deja elegir otro método', async () => {
    firebase.finishGoogleSignIn.mockRejectedValue(
      Object.assign(new Error('nope'), { code: 'auth/account-exists-with-different-credential' }),
    );

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Correo y contraseña')).toBeTruthy();
  });
});

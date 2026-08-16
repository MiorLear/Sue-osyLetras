import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// La franja va anclada abajo, asi que antes de iniciar sesion se comia el boton
// "Iniciar sesion". Solo se ofrece con sesion abierta.
const auth = vi.hoisted(() => ({ authed: true }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));

import { InstallPrompt } from './InstallPrompt';

const manifest = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../../public/manifest.webmanifest'), 'utf8'),
);

function setUserAgent(ua: string, maxTouchPoints = 0) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  });
}

function mockDisplayMode(standalone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: standalone && query.includes('standalone'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

function firePrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = Object.assign(new Event('beforeinstallprompt'), {
    platforms: ['web'],
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
    prompt: vi.fn().mockResolvedValue(undefined),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('manifest.webmanifest', () => {
  it('declara lo que exige la instalación', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toMatch(/^#/);
    expect(manifest.background_color).toMatch(/^#/);
  });

  it('trae iconos de 192 y 512 más un maskable', () => {
    const png = manifest.icons.filter((i: { type: string }) => i.type === 'image/png');
    expect(png.some((i: { sizes: string }) => i.sizes === '192x192')).toBe(true);
    expect(png.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
    expect(
      manifest.icons.some((i: { purpose?: string }) => i.purpose?.includes('maskable')),
    ).toBe(true);
  });
});

describe('<InstallPrompt />', () => {
  beforeEach(() => {
    mockDisplayMode(false);
    setUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120');
  });
  afterEach(cleanup);

  it('se ofrece en escritorio y usa el prompt nativo en cuanto llega', async () => {
    render(<InstallPrompt />);
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeTruthy();

    const event = firePrompt();
    await act(async () => {
      screen.getByRole('button', { name: 'Instalar' }).click();
    });
    expect(event.prompt).toHaveBeenCalled();
  });

  // Firefox no implementa beforeinstallprompt y Chrome lo retiene hasta que hay
  // interacción: sin esta salida, "Instalar" no haría nada y parecería roto.
  it('si el navegador nunca dispara el prompt, explica la ruta manual', async () => {
    render(<InstallPrompt />);
    await act(async () => {
      screen.getByRole('button', { name: 'Instalar' }).click();
    });
    expect(screen.getByText(/icono de instalación/i)).toBeTruthy();
  });

  it('en iOS ofrece los pasos manuales porque no existe la API de prompt', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', 5);
    render(<InstallPrompt />);
    expect(screen.getByRole('button', { name: 'Cómo' })).toBeTruthy();
    expect(screen.getByText(/pantalla de inicio/i)).toBeTruthy();
  });

  it('no molesta cuando ya está instalada', () => {
    mockDisplayMode(true);
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', 5);
    render(<InstallPrompt />);
    expect(screen.queryByRole('region', { name: /instalar/i })).toBeNull();
  });

  it('«Ahora no» lo posterga, no lo mata para siempre', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', 5);
    const { unmount } = render(<InstallPrompt />);
    screen.getByRole('button', { name: 'Ahora no' }).click();
    unmount();

    render(<InstallPrompt />);
    expect(screen.queryByRole('region', { name: /instalar/i })).toBeNull();

    const until = Number(localStorage.getItem('explorarte.install.snoozed-until'));
    expect(until).toBeGreaterThan(Date.now());
    expect(until).toBeLessThan(Date.now() + 15 * 86_400_000);
  });

  it('rechazar el diálogo nativo también lo posterga', async () => {
    render(<InstallPrompt />);
    firePrompt('dismissed');
    await act(async () => {
      screen.getByRole('button', { name: 'Instalar' }).click();
    });

    expect(screen.queryByRole('region', { name: /instalar/i })).toBeNull();
    expect(Number(localStorage.getItem('explorarte.install.snoozed-until'))).toBeGreaterThan(
      Date.now(),
    );
  });
});

describe('<InstallPrompt /> · antes de iniciar sesión', () => {
  it('no se ofrece en la pantalla de entrada', () => {
    // Va anclada abajo y tapaba el botón "Iniciar sesión" y las cuentas de
    // demostración: lo primero que veía una docente nueva era una app que
    // parecía rota. Y un permiso pedido antes de saber qué es esto es un
    // permiso que se deniega.
    mockDisplayMode(false);
    setUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120');
    auth.authed = false;
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
    auth.authed = true;
  });
});

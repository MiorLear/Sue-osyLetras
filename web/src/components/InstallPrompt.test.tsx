import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function firePrompt() {
  const event = Object.assign(new Event('beforeinstallprompt'), {
    platforms: ['web'],
    userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
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

  it('no aparece hasta que el navegador dice que la app es instalable', () => {
    render(<InstallPrompt />);
    expect(screen.queryByRole('region', { name: /instalar/i })).toBeNull();

    firePrompt();
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeTruthy();
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
});

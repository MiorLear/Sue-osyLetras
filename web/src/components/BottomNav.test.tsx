import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false, signOut: vi.fn(async () => undefined) }),
}));
import { BottomNav } from './BottomNav';
import { MAIN_TABS, SECONDARY_NAV, TEACHER_NAV } from './nav-items';

// Normalizado a LF: el repo se edita desde Windows y git reescribe los finales.
const css = readFileSync(path.resolve(import.meta.dirname, '../styles/global.css'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('<BottomNav />', () => {
  it('muestra Inicio y los tres módulos de ExplorArte, más "Más"', () => {
    renderAt('/main');
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    const labels = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual([...MAIN_TABS.map((t) => t.label), 'Más']);
  });

  it('marca la pestaña de la sección actual', () => {
    renderAt('/herramientas');
    expect(screen.getByRole('button', { name: /Herramientas/ })).toHaveProperty(
      'ariaCurrent',
      'page',
    );
  });

  it('marca una subruta como parte de su sección', () => {
    renderAt('/emociones/7');
    expect(screen.getByRole('button', { name: /Emociones/ })).toHaveProperty(
      'ariaCurrent',
      'page',
    );
  });

  it('"Más" abre una hoja con lo que no es ya una pestaña', () => {
    renderAt('/main');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Más/ }));
    const sheet = screen.getByRole('dialog', { name: /más secciones/i });
    const labels = Array.from(sheet.querySelectorAll('button')).map((b) => b.textContent);

    // Ninguna sección puede quedar inalcanzable en teléfono: o es pestaña, o
    // está en la hoja.
    for (const item of [...TEACHER_NAV, ...SECONDARY_NAV]) {
      const isTab = MAIN_TABS.some((tab) => tab.href === item.href);
      const inSheet = labels.some((l) => l?.includes(item.label));
      expect(isTab || inSheet).toBe(true);
    }

    // Y la hoja no repite lo que ya está abajo.
    for (const tab of MAIN_TABS) {
      const duplicated = [...TEACHER_NAV, ...SECONDARY_NAV].some(
        (item) => item.href === tab.href && labels.some((l) => l?.includes(item.label)),
      );
      expect(duplicated).toBe(false);
    }
  });

  it('cierra la hoja con Escape', () => {
    renderAt('/main');
    fireEvent.click(screen.getByRole('button', { name: /Más/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('shell móvil: safe areas y objetivos táctiles', () => {
  it('la barra de tabs respeta el home indicator', () => {
    expect(css).toContain('padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px))');
  });

  it('la barra superior respeta el notch', () => {
    expect(css).toContain('calc(10px + env(safe-area-inset-top, 0px))');
  });

  it('el contenido deja hueco para la barra de tabs', () => {
    expect(css).toContain('var(--bottom-nav-height)');
  });

  it('los botones de la barra llegan al mínimo de 44px', () => {
    const bar = css.slice(css.indexOf('.bottom-nav button {'));
    expect(bar.slice(0, 400)).toContain('min-height: 44px');
  });

  it('el sidebar ya no se convierte en un carrusel horizontal', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 760px)'));
    expect(mobile).toContain('.sidebar {\n    display: none;\n  }');
    expect(mobile).not.toContain('overflow-x: auto');
  });
});

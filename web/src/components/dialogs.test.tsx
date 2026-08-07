import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { Toaster } from './Toaster';
import { clearToasts, toast } from './toast-store';
import { confirmDialog } from './confirm-store';

afterEach(() => {
  cleanup();
  act(() => clearToasts());
});

describe('toasts', () => {
  it('anuncia amablemente a los lectores de pantalla', () => {
    render(<Toaster />);
    const region = screen.getByRole('status');
    // La región existe desde el primer pintado: si apareciera junto con su
    // contenido, muchos lectores de pantalla no anunciarían nada.
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it('muestra el mensaje sin bloquear nada', () => {
    render(<Toaster />);
    act(() => {
      toast.error('No se pudo actualizar tu reacción. Inténtalo de nuevo.');
    });
    expect(screen.getByText(/no se pudo actualizar/i)).toBeTruthy();
  });

  it('acepta título y cuerpo, como los antiguos "Próximamente"', () => {
    render(<Toaster />);
    act(() => {
      toast.info('Estará disponible muy pronto.', { title: 'Próximamente' });
    });
    expect(screen.getByText('Próximamente')).toBeTruthy();
    expect(screen.getByText('Estará disponible muy pronto.')).toBeTruthy();
  });

  it('se puede cerrar a mano y se va solo', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success('Guardado');
    });
    fireEvent.click(screen.getByRole('button', { name: /cerrar aviso/i }));
    expect(screen.queryByText('Guardado')).toBeNull();

    act(() => {
      toast.success('Otro');
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByText('Otro')).toBeNull();
    vi.useRealTimers();
  });
});

describe('diálogo de confirmación', () => {
  it('resuelve true al confirmar', async () => {
    render(<ConfirmDialog />);
    let answer: boolean | undefined;
    act(() => {
      void confirmDialog({ title: '¿Eliminar el tema "Rutinas"?' }).then((v) => (answer = v));
    });

    expect(screen.getByText('¿Eliminar el tema "Rutinas"?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await act(async () => {});
    expect(answer).toBe(true);
  });

  it('resuelve false al cancelar', async () => {
    render(<ConfirmDialog />);
    let answer: boolean | undefined;
    act(() => {
      void confirmDialog({ title: '¿Eliminar?' }).then((v) => (answer = v));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    expect(answer).toBe(false);
  });

  it('Escape cancela: nunca confirma por accidente', async () => {
    render(<ConfirmDialog />);
    let answer: boolean | undefined;
    act(() => {
      void confirmDialog({ title: '¿Eliminar?' }).then((v) => (answer = v));
    });
    // <dialog> abierto con showModal() emite `cancel` con Escape.
    fireEvent(document.querySelector('dialog')!, new Event('cancel', { cancelable: true }));
    await act(async () => {});
    expect(answer).toBe(false);
  });

  it('usa un <dialog> real, que atrapa el foco y vive en el top layer', () => {
    render(<ConfirmDialog />);
    expect(document.querySelector('dialog')).toBeTruthy();
  });
});

// Criterio de aceptación de PWA-1.6: no queda ni un diálogo bloqueante.
describe('no queda ningún window.alert ni confirm en web/src', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );

  it('ningún archivo llama a alert(), confirm() o prompt() del navegador', () => {
    const offenders = walk(path.resolve(import.meta.dirname, '..'))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.d\.ts$/.test(f))
      .flatMap((file) => {
        const text = readFileSync(file, 'utf8');
        // `confirmDialog(` y `deferred.prompt()` no cuentan: el patrón exige
        // que la llamada sea a la global del navegador.
        const hits = text.match(/(?<![.\w])(window\.)?(alert|confirm|prompt)\s*\(/g) ?? [];
        return hits.length ? [`${path.basename(file)}: ${hits.join(', ')}`] : [];
      });
    expect(offenders).toEqual([]);
  });
});

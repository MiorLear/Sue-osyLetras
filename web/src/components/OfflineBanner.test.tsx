import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El banner solo habla cuando tiene algo que decir. Y donde se coloca importa:
// arriba y fijo, para no tapar la barra de pestañas de abajo ni quedarse
// debajo del notch en una PWA instalada.

let online = true;

vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => online,
}));

const { OfflineBanner, BANNER_BAR_STYLE } = await import('@/components/OfflineBanner');
const {
  beginSync,
  endSync,
  setPendingCount,
  setFailedCount,
  withSync,
  __resetSyncStatus,
  lastSyncTime,
} = await import('@/lib/sync-status');

// vitest corre sin `globals`, así que testing-library no engancha su limpieza
// automática y los renders se irían acumulando en document.body.
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  online = true;
  __resetSyncStatus();
});

describe('OfflineBanner · cuándo aparece', () => {
  it('no pinta nada con conexión y sin sincronizar', () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('avisa mientras hay una sincronización en curso', () => {
    render(<OfflineBanner />);
    act(() => beginSync());
    expect(screen.getByText('Sincronizando…')).toBeDefined();
  });

  it('vuelve a callarse cuando la sincronización termina', () => {
    const { container } = render(<OfflineBanner />);
    act(() => beginSync());
    act(() => endSync());
    expect(container.firstChild).toBeNull();
  });

  it('sin conexión dice que lo que se ve es contenido guardado', () => {
    online = false;
    render(<OfflineBanner />);
    expect(screen.getByText('Sin conexión — mostrando contenido guardado')).toBeDefined();
  });
});

describe('OfflineBanner · cambios pendientes', () => {
  it('cuenta los cambios que esperan a reconectar', () => {
    online = false;
    render(<OfflineBanner />);
    act(() => setPendingCount(3));
    expect(screen.getByText('Sin conexión — 3 cambios se sincronizarán al reconectar')).toBeDefined();
  });

  it('concuerda en singular', () => {
    online = false;
    render(<OfflineBanner />);
    act(() => setPendingCount(1));
    expect(screen.getByText('Sin conexión — 1 cambio se sincronizará al reconectar')).toBeDefined();
  });
});

describe('OfflineBanner · colocación', () => {
  it('va fijo arriba, así que no tapa la barra de pestañas de abajo', () => {
    online = false;
    const { container } = render(<OfflineBanner />);
    const bar = container.firstElementChild as HTMLElement;

    expect(bar.style.position).toBe('fixed');
    expect(bar.style.top).toBe('0px');
    expect(bar.style.bottom).toBe('');
  });

  it('respeta el área segura para no quedarse bajo el notch', () => {
    // Se afirma sobre la constante y no sobre el DOM: jsdom no entiende env()
    // y lo descarta al aplicar el estilo, así que leerlo de vuelta no probaría
    // nada.
    expect(String(BANNER_BAR_STYLE.paddingTop)).toContain('safe-area-inset-top');
    expect(BANNER_BAR_STYLE.paddingBottom).toBeUndefined();
  });

  it('no intercepta toques dirigidos a lo que hay debajo', () => {
    online = false;
    const { container } = render(<OfflineBanner />);
    expect((container.firstElementChild as HTMLElement).style.pointerEvents).toBe('none');
  });

  it('se anuncia a lectores de pantalla sin robar el foco', () => {
    online = false;
    render(<OfflineBanner />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});

describe('sync-status · store fuera de React', () => {
  it('varias tareas concurrentes colapsan en un solo "sincronizando"', () => {
    const { container } = render(<OfflineBanner />);
    act(() => {
      beginSync();
      beginSync();
    });
    expect(screen.getByText('Sincronizando…')).toBeDefined();

    act(() => endSync());
    // Sigue habiendo una tarea viva.
    expect(screen.getByText('Sincronizando…')).toBeDefined();

    act(() => endSync());
    expect(container.firstChild).toBeNull();
  });

  it('endSync de más no deja el contador en negativo', () => {
    const { container } = render(<OfflineBanner />);
    act(() => {
      endSync();
      endSync();
    });
    expect(container.firstChild).toBeNull();

    act(() => beginSync());
    expect(screen.getByText('Sincronizando…')).toBeDefined();
  });

  it('withSync marca la tarea y la desmarca aunque falle', async () => {
    render(<OfflineBanner />);

    await act(async () => {
      await expect(
        withSync(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    });

    expect(screen.queryByText('Sincronizando…')).toBeNull();
  });

  it('un módulo no-React puede actualizar el estado sin ningún contexto', () => {
    // Ni beginSync ni setPendingCount son hooks: los llama el replay del
    // outbox y la sincronización de medios desde código async plano.
    online = false;
    render(<OfflineBanner />);
    act(() => setPendingCount(2));
    expect(screen.getByText(/2 cambios/)).toBeDefined();
  });

  it('registra la hora del último sync al terminar', () => {
    expect(lastSyncTime()).toBeNull();
    act(() => {
      beginSync();
      endSync();
    });
    expect(lastSyncTime()).toBeTypeOf('number');
  });
});

describe('OfflineBanner · cambios que no se pudieron guardar', () => {
  // Sin esta barra, apartar un cambio sería una forma silenciosa de perderlo:
  // la franja de arriba seguiría prometiendo que todo se sincroniza.
  const withRouter = () =>
    render(
      <MemoryRouter>
        <OfflineBanner />
      </MemoryRouter>,
    );

  it('aparece aunque haya conexión y no se esté sincronizando', () => {
    withRouter();
    act(() => setFailedCount(2));
    expect(screen.getByText('2 cambios no se pudieron guardar')).toBeDefined();
  });

  it('concuerda en singular', () => {
    withRouter();
    act(() => setFailedCount(1));
    expect(screen.getByText('1 cambio no se pudo guardar')).toBeDefined();
  });

  it('lleva a la pantalla donde se decide qué hacer', () => {
    withRouter();
    act(() => setFailedCount(1));
    expect(screen.getByText('Revisar').getAttribute('href')).toBe('/sync-problemas');
  });

  it('el aviso de arriba nunca enseña dos cifras a la vez', () => {
    // Con cambios fallidos y pendientes manda el fallido, que es el accionable.
    online = false;
    withRouter();
    act(() => {
      setPendingCount(3);
      setFailedCount(2);
    });
    expect(screen.queryByText(/3 cambios se sincronizarán/)).toBeNull();
    expect(screen.getByText('Sin conexión — 2 cambios no se pudieron guardar')).toBeDefined();
  });

  it('desaparece sola al vaciarse la lista', () => {
    const { container } = withRouter();
    act(() => setFailedCount(1));
    expect(screen.getByText('Revisar')).toBeDefined();

    act(() => setFailedCount(0));
    expect(container.firstChild).toBeNull();
  });

  it('la franja de arriba sigue siendo inerte', () => {
    // Lo pulsable va abajo justamente porque la franja cruza el ancho completo
    // por encima de la barra superior del móvil.
    online = false;
    withRouter();
    act(() => setFailedCount(1));
    const franja = screen.getByText(/Sin conexión/).closest('div[role="status"]') as HTMLElement;
    expect(franja.style.pointerEvents).toBe('none');
  });
});

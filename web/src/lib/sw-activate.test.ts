import { afterEach, describe, expect, it, vi } from 'vitest';

import { activateWaitingServiceWorker, refreshServiceWorkerForAuthScreen } from '@/lib/sw-activate';

// El caso real: una docente con el service worker anterior instalado. Ese
// worker le responde /__/auth/handler con el shell de la app y el login con
// Google falla, aunque el arreglo lleve días desplegado, hasta que alguien
// pulse "Actualizar". En la pantalla de login no hay nada sin guardar, así que
// ahí sí se puede forzar el relevo.

type Fake = ServiceWorkerContainer & { events: EventTarget };

function fakeContainer(registration: Partial<ServiceWorkerRegistration> | null): Fake {
  const events = new EventTarget();
  return {
    events,
    getRegistration: () => Promise.resolve(registration as ServiceWorkerRegistration | undefined),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  } as unknown as Fake;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

/** jsdom no implementa location.reload; se espía para poder observarlo. */
function spyOnReload() {
  const reload = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
  return reload;
}

describe('sw-activate', () => {
  it('no hace nada si el navegador no tiene service workers', async () => {
    await expect(activateWaitingServiceWorker({ container: undefined })).resolves.toBe(false);
  });

  it('no hace nada si no hay ningún worker registrado', async () => {
    const container = fakeContainer(null);
    await expect(activateWaitingServiceWorker({ container })).resolves.toBe(false);
  });

  it('no hace nada si no hay ningún worker esperando', async () => {
    const container = fakeContainer({ waiting: null, update: () => Promise.resolve() });
    await expect(activateWaitingServiceWorker({ container })).resolves.toBe(false);
  });

  it('le manda SKIP_WAITING al worker en espera y confirma el relevo', async () => {
    const postMessage = vi.fn();
    const container = fakeContainer({ waiting: { postMessage } as unknown as ServiceWorker });

    const activated = activateWaitingServiceWorker({ container, timeoutMs: 50 });
    // El relevo lo anuncia el navegador, no la promesa del postMessage.
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }));
    container.events.dispatchEvent(new Event('controllerchange'));

    await expect(activated).resolves.toBe(true);
  });

  // Si el relevo no llega, el login sigue adelante igual: un worker viejo es un
  // problema, pero bloquear el botón de Google es peor.
  it('se rinde en cuanto vence el tiempo, sin colgar el login', async () => {
    const container = fakeContainer({ waiting: { postMessage: vi.fn() } as unknown as ServiceWorker });
    await expect(activateWaitingServiceWorker({ container, timeoutMs: 10 })).resolves.toBe(false);
  });

  it('puede pedir primero una versión nueva al servidor', async () => {
    const update = vi.fn(() => Promise.resolve());
    const container = fakeContainer({ waiting: null, update: update as unknown as () => Promise<void> });

    await activateWaitingServiceWorker({ container, checkForUpdate: true, timeoutMs: 10 });

    expect(update).toHaveBeenCalled();
  });

  // update() puede quedarse colgado con mala conexión, y mientras tanto se está
  // gastando el gesto del usuario que permite abrir el popup de Google.
  it('no espera para siempre a un update() que no responde', async () => {
    const container = fakeContainer({
      waiting: null,
      update: (() => new Promise(() => {})) as unknown as () => Promise<void>,
    });

    await expect(
      activateWaitingServiceWorker({ container, checkForUpdate: true, timeoutMs: 10 }),
    ).resolves.toBe(false);
  });
});

describe('sw-activate · pantallas de autenticación', () => {
  it('recarga la página cuando el worker nuevo toma el control', async () => {
    const reload = spyOnReload();
    const postMessage = vi.fn();
    const container = fakeContainer({
      waiting: { postMessage } as unknown as ServiceWorker,
      update: (() => Promise.resolve()) as unknown as () => Promise<void>,
    });

    const done = refreshServiceWorkerForAuthScreen({ container, timeoutMs: 200 });
    // El SKIP_WAITING sale después de suscribirse a controllerchange: esperarlo
    // es lo que garantiza que el evento de abajo tenga quién lo escuche.
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    container.events.dispatchEvent(new Event('controllerchange'));
    await done;

    expect(reload).toHaveBeenCalled();
  });

  // Perder una contraseña a medio escribir por una actualización en segundo
  // plano es peor que quedarse con los assets viejos: el relevo del worker, que
  // es lo que arregla el login, ya ocurrió igual.
  it('no recarga si la usuaria está escribiendo', async () => {
    const reload = spyOnReload();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    const postMessage = vi.fn();
    const container = fakeContainer({
      waiting: { postMessage } as unknown as ServiceWorker,
      update: (() => Promise.resolve()) as unknown as () => Promise<void>,
    });

    const done = refreshServiceWorkerForAuthScreen({ container, timeoutMs: 200 });
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    container.events.dispatchEvent(new Event('controllerchange'));
    await done;

    expect(reload).not.toHaveBeenCalled();
  });

  it('no recarga cuando no había ningún worker esperando', async () => {
    const reload = spyOnReload();
    const container = fakeContainer({
      waiting: null,
      update: (() => Promise.resolve()) as unknown as () => Promise<void>,
    });

    await refreshServiceWorkerForAuthScreen({ container, timeoutMs: 10 });

    expect(reload).not.toHaveBeenCalled();
  });
});

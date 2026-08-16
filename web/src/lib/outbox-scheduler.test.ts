import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cuándo se intenta vaciar la bandeja. El único disparador de la versión RN era
// que cambiara la bandera de conexión (BUG-07), así que una tablet que arrancaba
// YA conectada con cambios en cola no reintentaba nunca.

type Stopped = 'drained' | 'session' | 'unreachable' | 'skipped';
type PassResult = { dispatched: number; dead: number; stopped: Stopped };


const outbox = vi.hoisted(() => ({
  replayPass: vi.fn<() => Promise<{ dispatched: number; dead: number; stopped: string }>>(),
  nextDueAt: vi.fn<() => Promise<number | null>>(),
  resetBackoff: vi.fn<() => Promise<void>>(async () => undefined),
  sweepStale: vi.fn<() => Promise<void>>(async () => undefined),
  refreshCounts: vi.fn<() => Promise<{ pending: number; failed: number }>>(async () => ({
    pending: 0,
    failed: 0,
  })),
  subscribeOutbox: vi.fn<(cb: () => void) => () => void>(() => () => undefined),
}));
vi.mock('@/lib/outbox', () => outbox);

const net = vi.hoisted(() => ({
  isOnline: vi.fn<() => boolean>(() => true),
  subscribeNetwork: vi.fn<(cb: () => void) => () => void>(() => () => undefined),
}));
vi.mock('@/lib/useNetworkStatus', () => net);

import { __resetScheduler, flushNow, startOutboxScheduler } from '@/lib/outbox-scheduler';

const pass = (stopped: Stopped): PassResult => ({ dispatched: 0, dead: 0, stopped });

/** El callback con el que el planificador escucha los cambios de red. */
const networkListener = (): (() => void) => net.subscribeNetwork.mock.calls.at(-1)![0];
/** Y el que escucha los cambios de la bandeja. */
const outboxListener = (): (() => void) => outbox.subscribeOutbox.mock.calls.at(-1)![0];

/** Deja correr las microtareas encadenadas del planificador. */
const settle = async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  __resetScheduler();
  net.isOnline.mockReturnValue(true);
  outbox.nextDueAt.mockResolvedValue(null);
  outbox.replayPass.mockResolvedValue(pass('drained'));
});

afterEach(() => {
  __resetScheduler();
  vi.useRealTimers();
});

describe('escalera · arranque', () => {
  it('limpia lo caducado, recuenta y lo intenta ya (BUG-07)', async () => {
    // Una tablet que arranca conectada con cambios en cola tiene que reintentar
    // sin esperar a que la conexión cambie: en un aula con wifi estable, eso
    // puede no pasar en toda la mañana.
    startOutboxScheduler();
    await settle();

    expect(outbox.sweepStale).toHaveBeenCalledTimes(1);
    expect(outbox.refreshCounts).toHaveBeenCalledTimes(1);
    expect(outbox.replayPass).toHaveBeenCalledTimes(1);
  });

  it('arrancar dos veces no duplica ni listeners ni pasadas (StrictMode)', async () => {
    const first = startOutboxScheduler();
    const second = startOutboxScheduler();
    await settle();

    expect(outbox.replayPass).toHaveBeenCalledTimes(1);
    expect(net.subscribeNetwork).toHaveBeenCalledTimes(1);

    // Y hace falta soltar los dos para que se apague de verdad.
    first.stop();
    expect(net.subscribeNetwork).toHaveBeenCalledTimes(1);
    second.stop();
  });
});

describe('escalera · vuelve la conexión', () => {
  it('dispara en la transición, no por seguir conectada', async () => {
    net.isOnline.mockReturnValue(false);
    startOutboxScheduler();
    await settle();
    outbox.replayPass.mockClear();

    // Sigue sin conexión: nada.
    networkListener()();
    await settle();
    expect(outbox.replayPass).not.toHaveBeenCalled();

    // Vuelve: una pasada.
    net.isOnline.mockReturnValue(true);
    networkListener()();
    await settle();
    expect(outbox.replayPass).toHaveBeenCalledTimes(1);

    // Y seguir conectada no vuelve a disparar.
    networkListener()();
    await settle();
    expect(outbox.replayPass).toHaveBeenCalledTimes(1);
  });

  it('al reconectar, nadie sigue esperando su turno', async () => {
    net.isOnline.mockReturnValue(false);
    startOutboxScheduler();
    await settle();
    outbox.resetBackoff.mockClear();

    net.isOnline.mockReturnValue(true);
    networkListener()();
    await settle();

    expect(outbox.resetBackoff).toHaveBeenCalledTimes(1);
  });

  it('un intento por temporizador no reinicia la espera', async () => {
    startOutboxScheduler();
    await settle();
    outbox.resetBackoff.mockClear();

    flushNow('timer');
    await settle();

    expect(outbox.resetBackoff).not.toHaveBeenCalled();
  });
});

describe('escalera · volver a primer plano', () => {
  it('dispara al volver, pero no dos veces seguidas', async () => {
    startOutboxScheduler();
    await settle();
    outbox.replayPass.mockClear();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(outbox.replayPass).toHaveBeenCalledTimes(1);

    // Cambiar de pestaña no puede martillear la API.
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(outbox.replayPass).toHaveBeenCalledTimes(1);
  });

  it('no dispara al esconderse', async () => {
    startOutboxScheduler();
    await settle();
    outbox.replayPass.mockClear();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();

    expect(outbox.replayPass).not.toHaveBeenCalled();
  });
});

describe('escalera · temporizador', () => {
  it('se arma al instante que dicen los datos, ni antes ni después', async () => {
    outbox.nextDueAt.mockResolvedValue(Date.now() + 30_000);
    startOutboxScheduler();
    await settle();
    outbox.replayPass.mockClear();

    await vi.advanceTimersByTimeAsync(29_000);
    expect(outbox.replayPass).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_500);
    expect(outbox.replayPass).toHaveBeenCalledTimes(1);
  });

  it('con la cola vacía no queda ningún temporizador vivo', async () => {
    outbox.nextDueAt.mockResolvedValue(null);
    startOutboxScheduler();
    await settle();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('sin conexión no se arma nada', async () => {
    net.isOnline.mockReturnValue(false);
    outbox.nextDueAt.mockResolvedValue(Date.now() + 1_000);
    startOutboxScheduler();
    await settle();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('no se rearma tras una sesión muerta: viene la redirección', async () => {
    outbox.nextDueAt.mockResolvedValue(Date.now() + 1_000);
    outbox.replayPass.mockResolvedValue(pass('session'));
    startOutboxScheduler();
    await settle();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('no se rearma sin salida a la red: martillear el punto de acceso gasta batería', async () => {
    outbox.nextDueAt.mockResolvedValue(Date.now() + 1_000);
    outbox.replayPass.mockResolvedValue(pass('unreachable'));
    startOutboxScheduler();
    await settle();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('encolar algo rearma el temporizador', async () => {
    outbox.nextDueAt.mockResolvedValue(null);
    startOutboxScheduler();
    await settle();
    expect(vi.getTimerCount()).toBe(0);

    // La cola pasa de vacía a no vacía.
    outbox.nextDueAt.mockResolvedValue(Date.now() + 5_000);
    outboxListener()();
    await settle();

    expect(vi.getTimerCount()).toBe(1);
  });

  it('perder la conexión apaga el temporizador', async () => {
    outbox.nextDueAt.mockResolvedValue(Date.now() + 60_000);
    startOutboxScheduler();
    await settle();
    expect(vi.getTimerCount()).toBe(1);

    net.isOnline.mockReturnValue(false);
    networkListener()();
    await settle();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('escalera · apagado', () => {
  it('stop() suelta las suscripciones y el temporizador', async () => {
    const off = vi.fn();
    net.subscribeNetwork.mockReturnValue(off);
    outbox.nextDueAt.mockResolvedValue(Date.now() + 60_000);

    const handle = startOutboxScheduler();
    await settle();
    expect(vi.getTimerCount()).toBe(1);

    handle.stop();

    expect(off).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop() dos veces no rompe nada', async () => {
    const handle = startOutboxScheduler();
    await settle();
    handle.stop();
    expect(() => handle.stop()).not.toThrow();
  });
});

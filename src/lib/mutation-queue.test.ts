import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as MutationQueue from '@/lib/mutation-queue';

// Red de seguridad del outbox offline antes de portarlo a IndexedDB (MAINT-01).
// Los tres ejes que cubre: coalescing (que dos ediciones no se repliquen dos
// veces), remapeo de ids (que nunca se despache una operacion contra un id
// temporal que el servidor no conoce) y clasificacion de reintentos (que pasa
// cuando una mutacion falla en medio del flush).
//
// El modulo guarda la cola en estado de modulo, asi que cada test reimporta con
// vi.resetModules() para arrancar de cero.

const STORAGE_KEY = 'offline-mutations-v1';

let store: Record<string, string>;

const asyncStorage = {
  getItem: vi.fn(async (k: string) => store[k] ?? null),
  setItem: vi.fn(async (k: string, v: string) => {
    store[k] = v;
  }),
  removeItem: vi.fn(async (k: string) => {
    delete store[k];
  }),
};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

// withSync solo enciende el banner global; en test se reduce a ejecutar la tarea.
vi.mock('@/lib/sync-status', () => ({
  withSync: <T,>(task: () => Promise<T>) => task(),
}));

const apiMock = {
  profile: { update: vi.fn(async () => ({})) },
  events: { create: vi.fn(async () => ({})), update: vi.fn(async () => ({})), remove: vi.fn(async () => undefined) },
  posts: { create: vi.fn(async () => ({})), toggleLike: vi.fn(async () => ({})), addComment: vi.fn(async () => ({})) },
};

vi.mock('@/lib/api', () => ({ api: apiMock }));

/** Cola tal y como quedo persistida en AsyncStorage. */
function persisted(): { kind: string; [k: string]: unknown }[] {
  return store[STORAGE_KEY] ? JSON.parse(store[STORAGE_KEY]) : [];
}

async function load(seed?: unknown[]): Promise<typeof MutationQueue> {
  store = {};
  if (seed) store[STORAGE_KEY] = JSON.stringify(seed);
  vi.resetModules();
  return import('@/lib/mutation-queue');
}

const eventInput = { title: 'Taller', date: '2026-03-01', time: '10:00', type: 'workshop' } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('outbox · persistencia', () => {
  it('rehidrata la cola guardada de una sesion anterior', async () => {
    const q = await load([{ id: 'm-1', kind: 'event.remove', targetId: 'e-9' }]);
    await q.loadQueue();
    await q.flushQueue();
    expect(apiMock.events.remove).toHaveBeenCalledWith('e-9');
  });

  it('sobrevive a un JSON corrupto en vez de tirar la app', async () => {
    store = { [STORAGE_KEY]: 'no-soy-json' };
    vi.resetModules();
    const q = await import('@/lib/mutation-queue');
    await expect(q.loadQueue()).resolves.toBeUndefined();
    await q.enqueueEventRemove('e-1');
    expect(persisted()).toHaveLength(1);
  });
});

describe('outbox · coalescing', () => {
  it('deja una sola actualizacion de perfil, la ultima', async () => {
    const q = await load();
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.enqueueProfileUpdate({ name: 'Ana Maria' } as never);

    expect(persisted()).toHaveLength(1);
    expect(persisted()[0]).toMatchObject({ kind: 'profile.update', input: { name: 'Ana Maria' } });
  });

  it('fusiona ediciones consecutivas del mismo evento ya sincronizado', async () => {
    const q = await load();
    await q.enqueueEventUpdate('e-1', { title: 'A' } as never);
    await q.enqueueEventUpdate('e-1', { time: '11:00' } as never);

    expect(persisted()).toHaveLength(1);
    expect(persisted()[0]).toMatchObject({ kind: 'event.update', targetId: 'e-1', input: { title: 'A', time: '11:00' } });
  });

  it('un like y su deshacer se anulan entre si', async () => {
    const q = await load();
    await q.enqueuePostLike(7);
    await q.enqueuePostLike(7);

    expect(persisted()).toHaveLength(0);
  });

  it('likes a posts distintos no se anulan', async () => {
    const q = await load();
    await q.enqueuePostLike(7);
    await q.enqueuePostLike(8);

    expect(persisted().map((m) => m.postId)).toEqual([7, 8]);
  });
});

describe('outbox · ids temporales', () => {
  it('pliega la edicion de un evento creado offline dentro de su create', async () => {
    const q = await load();
    await q.enqueueEventCreate('tmp-1', eventInput);
    await q.enqueueEventUpdate('tmp-1', { title: 'Titulo corregido' } as never);

    const queue = persisted();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ kind: 'event.create', tempId: 'tmp-1' });
    expect((queue[0] as unknown as { input: { title: string } }).input.title).toBe('Titulo corregido');
  });

  it('nunca despacha un update contra un id temporal', async () => {
    const q = await load();
    await q.enqueueEventCreate('tmp-1', eventInput);
    await q.enqueueEventUpdate('tmp-1', { title: 'Titulo corregido' } as never);
    await q.flushQueue();

    expect(apiMock.events.update).not.toHaveBeenCalled();
    expect(apiMock.events.create).toHaveBeenCalledTimes(1);
    expect(apiMock.events.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Titulo corregido' }));
  });

  it('borrar un evento creado offline cancela su create y sus ediciones', async () => {
    const q = await load();
    await q.enqueueEventCreate('tmp-1', eventInput);
    await q.enqueueEventUpdate('tmp-1', { title: 'X' } as never);
    await q.enqueueEventRemove('tmp-1');

    expect(persisted()).toHaveLength(0);
    await q.flushQueue();
    expect(apiMock.events.create).not.toHaveBeenCalled();
    expect(apiMock.events.remove).not.toHaveBeenCalled();
  });

  it('borrar un evento ya sincronizado descarta sus ediciones pendientes', async () => {
    const q = await load();
    await q.enqueueEventUpdate('e-1', { title: 'X' } as never);
    await q.enqueueEventRemove('e-1');

    expect(persisted()).toEqual([expect.objectContaining({ kind: 'event.remove', targetId: 'e-1' })]);
  });
});

describe('outbox · flush', () => {
  it('despacha en orden y vacia la cola', async () => {
    const order: string[] = [];
    apiMock.profile.update.mockImplementation(async () => {
      order.push('profile');
      return {};
    });
    apiMock.posts.create.mockImplementation(async () => {
      order.push('post');
      return {};
    });

    const q = await load();
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.enqueuePostCreate(-1, { text: 'hola' } as never);
    await q.flushQueue();

    expect(order).toEqual(['profile', 'post']);
    expect(persisted()).toHaveLength(0);
  });

  it('para en el primer fallo y conserva el resto para el siguiente reintento', async () => {
    apiMock.profile.update.mockRejectedValueOnce(new Error('network'));

    const q = await load();
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.enqueuePostCreate(-1, { text: 'hola' } as never);
    await q.flushQueue();

    expect(apiMock.posts.create).not.toHaveBeenCalled();
    expect(persisted().map((m) => m.kind)).toEqual(['profile.update', 'post.create']);
  });

  it('reintenta lo que quedo pendiente en el siguiente flush', async () => {
    apiMock.profile.update.mockRejectedValueOnce(new Error('network'));

    const q = await load();
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.enqueuePostCreate(-1, { text: 'hola' } as never);
    await q.flushQueue();
    await q.flushQueue();

    expect(apiMock.profile.update).toHaveBeenCalledTimes(2);
    expect(apiMock.posts.create).toHaveBeenCalledTimes(1);
    expect(persisted()).toHaveLength(0);
  });

  it('persiste el avance parcial: lo ya despachado no se repite', async () => {
    apiMock.posts.create.mockRejectedValue(new Error('network'));

    const q = await load();
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.enqueuePostCreate(-1, { text: 'hola' } as never);
    await q.flushQueue();

    expect(persisted().map((m) => m.kind)).toEqual(['post.create']);
  });

  // --- Deuda conocida, documentada como test en rojo -----------------------
  // Ver AUDIT.md §6. No se arreglan aqui: este PR es de guardrails y los bugs
  // tienen su propio ticket. Quitar el .skip cuando se cierren.

  it.skip('BUG-03: una mutacion permanentemente invalida deberia ir al dead-letter, no bloquear la cola', async () => {
    // Hoy flushQueue hace `catch { break }` sin contador de intentos ni tope, y
    // un 403 es indistinguible de un corte de red: la cola queda bloqueada para
    // siempre mientras el banner sigue diciendo "N cambios se sincronizaran".
    const permanent = Object.assign(new Error('forbidden'), { status: 403 });
    apiMock.posts.addComment.mockRejectedValue(permanent);

    const q = await load();
    await q.enqueuePostComment(1, { text: 'sobre un post borrado' } as never);
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.flushQueue();

    // Esperado: el comentario invalido se descarta y el perfil sigue adelante.
    expect(apiMock.profile.update).toHaveBeenCalledTimes(1);
    expect(persisted()).toHaveLength(0);
  });

  it.skip('BUG-04: encolar durante el flush no deberia re-despachar lo ya enviado', async () => {
    // enqueueEventRemove hace `queue = queue.filter(...)`, reemplazando la
    // referencia del array mientras flushQueue lo esta recorriendo. El bucle en
    // vuelo sigue mutando un array huerfano.
    const q = await load();
    await q.enqueueEventCreate('tmp-1', eventInput);
    apiMock.events.create.mockImplementation(async () => {
      await q.enqueueEventRemove('e-otro');
      return {};
    });

    await q.flushQueue();
    await q.flushQueue();

    expect(apiMock.events.create).toHaveBeenCalledTimes(1);
  });
});

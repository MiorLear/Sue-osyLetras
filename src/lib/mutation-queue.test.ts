import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('outbox · ids temporales de posts (BUG-06)', () => {
  // Un post creado sin conexion no se podia gustar ni comentar hasta que
  // sincronizara: enqueuePostLike/Comment exigian un id numerico real y las
  // pantallas lo parcheaban caso por caso. Ahora la cola lleva un mapa
  // temp -> real y reescribe lo encolado en cuanto el servidor asigna el id.

  it('un like sobre un post creado offline se replica contra el id real', async () => {
    apiMock.posts.create.mockResolvedValue({ id: 42 } as never);

    const q = await load();
    const tempId = q.newTempPostId();
    await q.enqueuePostCreate(tempId, { text: 'hola' } as never);
    await q.enqueuePostLike(tempId);
    await q.enqueuePostComment(tempId, { text: 'me respondo' } as never);
    await q.flushQueue();

    expect(apiMock.posts.toggleLike).toHaveBeenCalledWith(42);
    expect(apiMock.posts.addComment).toHaveBeenCalledWith(42, expect.objectContaining({ text: 'me respondo' }));
    expect(persisted()).toHaveLength(0);
  });

  it('el id temporal se distingue del real a simple vista', async () => {
    const q = await load();
    expect(q.isTempPostId(q.newTempPostId())).toBe(true);
    expect(q.isTempPostId(42)).toBe(false);
  });

  it('el mapa sobrevive: un like posterior al sync tambien va al id real', async () => {
    apiMock.posts.create.mockResolvedValue({ id: 42 } as never);

    const q = await load();
    const tempId = q.newTempPostId();
    await q.enqueuePostCreate(tempId, { text: 'hola' } as never);
    await q.flushQueue();

    // La pantalla sigue mostrando el id temporal hasta el siguiente reload.
    await q.enqueuePostLike(tempId);
    await q.flushQueue();

    expect(apiMock.posts.toggleLike).toHaveBeenCalledWith(42);
  });

  it('los dos toggles siguen anulandose aunque uno use el id temporal', async () => {
    apiMock.posts.create.mockResolvedValue({ id: 42 } as never);

    const q = await load();
    const tempId = q.newTempPostId();
    await q.enqueuePostCreate(tempId, { text: 'hola' } as never);
    await q.flushQueue();

    await q.enqueuePostLike(tempId); // via mapa -> 42
    await q.enqueuePostLike(42); // el mismo post, ya con id real
    expect(persisted()).toHaveLength(0);
  });

  it('si el post no se pudo crear, sus likes y comentarios no quedan huerfanos', async () => {
    apiMock.posts.create.mockRejectedValue(Object.assign(new Error('bad'), { status: 422 }));

    const q = await load();
    const tempId = q.newTempPostId();
    await q.enqueuePostCreate(tempId, { text: 'hola' } as never);
    await q.enqueuePostLike(tempId);
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.flushQueue();

    expect(apiMock.posts.toggleLike).not.toHaveBeenCalled();
    expect(apiMock.profile.update).toHaveBeenCalledTimes(1);
    expect(persisted()).toHaveLength(0);
    expect(await q.listFailedMutations()).toHaveLength(2);
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

  it('BUG-03: una mutacion permanentemente invalida va al dead-letter, no bloquea la cola', async () => {
    const permanent = Object.assign(new Error('forbidden'), { status: 403 });
    apiMock.posts.addComment.mockRejectedValue(permanent);

    const q = await load();
    await q.enqueuePostComment(1, { text: 'sobre un post borrado' } as never);
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.flushQueue();

    // El comentario invalido se descarta y el perfil sigue adelante.
    expect(apiMock.profile.update).toHaveBeenCalledTimes(1);
    expect(persisted()).toHaveLength(0);
  });

  it('BUG-04: encolar durante el flush no re-despacha lo ya enviado', async () => {
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

  it('BUG-04: encolar durante el flush tampoco se traga lo pendiente', async () => {
    // La variante que si perdia datos: la profesora vuelve a guardar el perfil
    // mientras el flush esta en vuelo. enqueueProfileUpdate hacia
    // `queue = queue.filter(...)`, reemplazando la referencia del array; el
    // `queue.shift()` del bucle caia entonces sobre el array nuevo y se comia
    // el evento que aun no se habia despachado.
    const q = await load();
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.enqueueEventCreate('tmp-1', eventInput);
    apiMock.profile.update.mockImplementationOnce(async () => {
      await q.enqueueProfileUpdate({ name: 'Ana Maria' } as never);
      return {};
    });

    await q.flushQueue();
    await q.flushQueue();

    expect(apiMock.events.create).toHaveBeenCalledTimes(1);
    expect(apiMock.profile.update).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Ana Maria' }));
    expect(persisted()).toHaveLength(0);
  });
});

describe('outbox · clasificacion de errores', () => {
  const failing = (status?: number) => Object.assign(new Error('boom'), status ? { status } : {});

  it.each([400, 403, 404, 409, 422])('un %i se aparca y el flush continua', async (status) => {
    apiMock.posts.addComment.mockRejectedValue(failing(status));

    const q = await load();
    await q.enqueuePostComment(1, { text: 'x' } as never);
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.flushQueue();

    expect(apiMock.profile.update).toHaveBeenCalledTimes(1);
    expect(persisted()).toHaveLength(0);
    const parked = await q.listFailedMutations();
    expect(parked).toHaveLength(1);
    expect(parked[0]).toMatchObject({ status, mutation: { kind: 'post.comment' } });
  });

  it.each([408, 429, 500, 503])('un %i se reintenta y detiene la pasada', async (status) => {
    apiMock.posts.addComment.mockRejectedValue(failing(status));

    const q = await load();
    await q.enqueuePostComment(1, { text: 'x' } as never);
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.flushQueue();

    expect(apiMock.profile.update).not.toHaveBeenCalled();
    expect(persisted()).toHaveLength(2);
    expect(persisted()[0]).toMatchObject({ kind: 'post.comment', attempts: 1 });
    expect(await q.listFailedMutations()).toHaveLength(0);
  });

  it('un fallo de red (sin status) cuenta como transitorio', async () => {
    apiMock.posts.addComment.mockRejectedValue(failing());

    const q = await load();
    await q.enqueuePostComment(1, { text: 'x' } as never);
    await q.flushQueue();

    expect(persisted()[0]).toMatchObject({ attempts: 1 });
    expect(await q.listFailedMutations()).toHaveLength(0);
  });

  it('un 401 detiene la pasada sin gastar intentos ni reintentar en bucle', async () => {
    // La sesion caduco: el cliente de API ya esta rebotando a login. Reintentar
    // solo daria vueltas por la redireccion.
    apiMock.posts.addComment.mockRejectedValue(failing(401));

    const q = await load();
    await q.enqueuePostComment(1, { text: 'x' } as never);
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    await q.flushQueue();
    await q.flushQueue();

    expect(apiMock.posts.addComment).toHaveBeenCalledTimes(2);
    expect(apiMock.profile.update).not.toHaveBeenCalled();
    expect(persisted()[0]).not.toHaveProperty('attempts');
    expect(await q.listFailedMutations()).toHaveLength(0);
  });

  it('al agotar el tope de intentos la mutacion se aparca y la cola sigue', async () => {
    apiMock.posts.addComment.mockRejectedValue(failing(503));

    const q = await load();
    await q.enqueuePostComment(1, { text: 'x' } as never);
    await q.enqueueProfileUpdate({ name: 'Ana' } as never);
    for (let i = 0; i < q.MAX_ATTEMPTS; i += 1) await q.flushQueue();

    expect(apiMock.posts.addComment).toHaveBeenCalledTimes(q.MAX_ATTEMPTS);
    expect(apiMock.profile.update).toHaveBeenCalledTimes(1);
    expect(persisted()).toHaveLength(0);
    const parked = await q.listFailedMutations();
    expect(parked).toHaveLength(1);
    expect(parked[0].reason).toMatch(/varios intentos/);
  });

  it('los fallos aparcados sobreviven al reinicio y se pueden descartar', async () => {
    apiMock.posts.addComment.mockRejectedValue(failing(404));

    const q = await load();
    await q.enqueuePostComment(1, { text: 'x' } as never);
    await q.flushQueue();
    expect(await q.listFailedMutations()).toHaveLength(1);

    // Reinicio de la app con el mismo AsyncStorage.
    vi.resetModules();
    const fresh = await import('@/lib/mutation-queue');
    expect(await fresh.listFailedMutations()).toHaveLength(1);

    await fresh.discardFailedMutations();
    expect(await fresh.listFailedMutations()).toHaveLength(0);
  });
});

describe('outbox · escalera de reintentos', () => {
  // BUG-07: el unico disparador era que el flag `online` cambiara, asi que un
  // dispositivo que arranca ya conectado con cola pendiente no reintentaba
  // nunca. La invariante nueva: mientras haya trabajo encolado, siempre hay un
  // flush programado.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('arrancar la escalera reintenta ya, sin esperar a un cambio de conectividad', async () => {
    const q = await load([{ id: 'm-1', kind: 'event.remove', targetId: 'e-9' }]);
    const stop = q.startOutboxRetries();
    await vi.waitFor(() => expect(apiMock.events.remove).toHaveBeenCalledWith('e-9'));
    stop();
  });

  it('reintenta con backoff mientras quede trabajo, y para al vaciarse la cola', async () => {
    apiMock.events.remove.mockRejectedValue(Object.assign(new Error('502'), { status: 502 }));

    const q = await load([{ id: 'm-1', kind: 'event.remove', targetId: 'e-9' }]);
    const stop = q.startOutboxRetries();
    await vi.waitFor(() => expect(apiMock.events.remove).toHaveBeenCalledTimes(1));

    // El temporizador queda armado aunque nadie toque la conectividad.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(apiMock.events.remove.mock.calls.length).toBeGreaterThan(1);

    // Cuando el servidor se recupera y la cola se vacia, el temporizador para.
    apiMock.events.remove.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    const afterDrain = apiMock.events.remove.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(apiMock.events.remove).toHaveBeenCalledTimes(afterDrain);

    stop();
  });

  it('el backoff esta topado y no dispara antes del minimo', async () => {
    apiMock.events.remove.mockRejectedValue(Object.assign(new Error('502'), { status: 502 }));

    const q = await load([{ id: 'm-1', kind: 'event.remove', targetId: 'e-9' }]);
    const stop = q.startOutboxRetries();
    await vi.waitFor(() => expect(apiMock.events.remove).toHaveBeenCalledTimes(1));

    // Primer tramo del backoff: 15 s ±25%, asi que a los 10 s no hay reintento.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(apiMock.events.remove).toHaveBeenCalledTimes(1);

    // Y aun con el tope de 5 min, media hora da varios reintentos, no uno solo.
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(apiMock.events.remove.mock.calls.length).toBeGreaterThan(4);

    stop();
  });

  it('parar la escalera cancela el temporizador', async () => {
    apiMock.events.remove.mockRejectedValue(Object.assign(new Error('502'), { status: 502 }));

    const q = await load([{ id: 'm-1', kind: 'event.remove', targetId: 'e-9' }]);
    const stop = q.startOutboxRetries();
    await vi.waitFor(() => expect(apiMock.events.remove).toHaveBeenCalledTimes(1));

    stop();
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(apiMock.events.remove).toHaveBeenCalledTimes(1);
  });
});

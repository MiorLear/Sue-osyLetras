import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Lo que la docente ve cuando escribe sin conexión. La bandeja es de verdad
// (fake-indexeddb); lo único mockeado es la red.

const api = vi.hoisted(() => ({
  posts: { list: vi.fn(), create: vi.fn(), toggleLike: vi.fn(), addComment: vi.fn() },
  media: { upload: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api }));

let online = true;
vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => online,
  isOnline: () => online,
  checkReachability: async () => online,
  subscribeNetwork: () => () => undefined,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'ana', name: 'Ana', lastname: 'Ruiz', role: 'teacher' },
  }),
}));

import Comunidad from '@/routes/Comunidad';
import { cacheKeys } from '@/lib/cache-keys';
import { clearEverything } from '@/lib/idb';
import { setCacheUser, writeCache } from '@/lib/offline-cache';
import { __resetOutbox, listPending, replayPass } from '@/lib/outbox';
import { __resetOutboxView } from '@/lib/use-outbox';
import { __resetSyncStatus } from '@/lib/sync-status';
import { clearToasts } from '@/components/toast-store';
import { Toaster } from '@/components/Toaster';

const POST = {
  id: 1,
  user: 'Bea',
  handle: '@bea',
  verified: false,
  time: 'hace 1 h',
  avatarBg: '#333',
  module: null,
  text: 'Hola comunidad',
  likes: 2,
  liked: false,
  reposts: 0,
  comments: [],
  attachments: [],
};

/** Con el Toaster montado: los avisos son parte de lo que se prueba. */
const Screen = () => (
  <MemoryRouter>
    <Comunidad />
    <Toaster />
  </MemoryRouter>
);

const view = () => render(<Screen />);

/** Abre el compositor, escribe y publica. */
async function publicar(text: string) {
  fireEvent.click(screen.getByLabelText('Crear publicación'));
  fireEvent.change(await screen.findByPlaceholderText('¿Qué quieres compartir con la comunidad?'), {
    target: { value: text },
  });
  fireEvent.click(screen.getByText('Publicar'));
}

beforeEach(async () => {
  vi.clearAllMocks();
  online = true;
  await clearEverything();
  __resetOutbox();
  __resetOutboxView();
  __resetSyncStatus();
  clearToasts();
  setCacheUser('ana');
  // Sembrada: sin red y sin caché la pantalla enseña el estado vacío, que es
  // correcto pero no es lo que se prueba aquí.
  await writeCache(cacheKeys.posts(undefined), [POST]);
  await writeCache(cacheKeys.posts('alegria'), []);
  await writeCache(cacheKeys.posts('tristeza'), []);
  api.posts.list.mockResolvedValue([POST]);
  api.posts.create.mockResolvedValue({ ...POST, id: 99, user: 'Ana Ruiz', text: 'nueva' });
  api.posts.toggleLike.mockResolvedValue({ ...POST, liked: true, likes: 3 });
  api.posts.addComment.mockResolvedValue({
    user: 'Ana Ruiz',
    initials: 'AR',
    avatarBg: '#3DBFB8',
    time: 'ahora',
    text: 'del servidor',
  });
});

afterEach(cleanup);

describe('<Comunidad /> · escribir sin conexión', () => {
  it('publica sin red, lo pinta y lo deja en la bandeja', async () => {
    online = false;
    view();
    await screen.findByText('Hola comunidad');

    await publicar('Mi primera sin conexión');

    // La insignia primero: el texto suelto también está en el compositor hasta
    // que se cierra, así que esperar por él no probaría que la tarjeta existe.
    expect(await screen.findByText('Pendiente de enviar')).toBeTruthy();
    expect(screen.getByText('Mi primera sin conexión').closest('article')).not.toBeNull();
    expect(api.posts.create).not.toHaveBeenCalled();
    await waitFor(async () => expect(await listPending()).toHaveLength(1));
  });

  it('comenta sin red y el comentario se ve marcado', async () => {
    online = false;
    view();
    await screen.findByText('Hola comunidad');

    fireEvent.click(screen.getByLabelText('Comentarios (0)'));
    fireEvent.change(await screen.findByPlaceholderText('Escribe un comentario...'), {
      target: { value: 'qué buena idea' },
    });
    fireEvent.click(screen.getByLabelText('Enviar comentario'));

    await waitFor(async () => expect(await listPending()).toHaveLength(1));
    expect(await screen.findByText('qué buena idea')).toBeTruthy();
    expect(screen.getByText('Sin enviar')).toBeTruthy();
    expect(api.posts.addComment).not.toHaveBeenCalled();
  });

  it('reacciona sin red sin llamar a la API', async () => {
    online = false;
    view();
    await screen.findByText('Hola comunidad');

    fireEvent.click(screen.getByLabelText('Me gusta'));

    await waitFor(async () => expect(await listPending()).toHaveLength(1));
    expect(api.posts.toggleLike).not.toHaveBeenCalled();
    expect(await screen.findByLabelText('Quitar me gusta, pendiente de enviar')).toBeTruthy();
  });

  it('adjuntar sin red se explica en vez de fallar', async () => {
    online = false;
    view();
    await screen.findByText('Hola comunidad');
    fireEvent.click(screen.getByLabelText('Crear publicación'));

    fireEvent.click(await screen.findByText('Imagen'));
    const input = document.querySelector('input[accept="image/*"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] },
    });

    expect(await screen.findByText(/necesitas conexión/i)).toBeTruthy();
    expect(api.media.upload).not.toHaveBeenCalled();
  });
});

describe('<Comunidad /> · reconciliación', () => {
  it('una revalidación no borra lo que sigue en la bandeja', async () => {
    // La regresión que justifica que la capa optimista viva FUERA del espejo:
    // al volver la red llega una lista del servidor que todavía no trae la
    // publicación, y el espejo se resincroniza. Si el borrador estuviera dentro,
    // desaparecería de la pantalla estando a salvo en la cola.
    online = false;
    const { rerender } = view();
    await screen.findByText('Hola comunidad');
    await publicar('Sigo aquí');
    // Se espera por la insignia y no por el texto: el texto también está en el
    // compositor hasta que se cierra, así que encontrarlo no probaría que la
    // tarjeta ya se pintó.
    await screen.findByText('Pendiente de enviar');

    online = true;
    rerender(<Screen />);

    await waitFor(() => expect(api.posts.list).toHaveBeenCalled());
    expect(screen.getByText('Sigo aquí').closest('article')).not.toBeNull();
    expect(screen.getByText('Pendiente de enviar')).toBeTruthy();
  });

  it('cuando el alta se envía de verdad, no queda la tarjeta duplicada', async () => {
    // El ciclo entero, sin refrescos a mano: publicar sin red, volver la
    // conexión y dejar que el replay la envíe. Si el replay no avisara de que
    // la fila salió de la bandeja, la copia optimista se quedaría encima de la
    // publicación real que llega en el refresco — el duplicado que todo el
    // diseño de la capa optimista existe para evitar.
    online = false;
    view();
    await screen.findByText('Hola comunidad');
    await publicar('Se va a enviar');
    await screen.findByText('Pendiente de enviar');

    const enviada = { ...POST, id: 42, user: 'Ana Ruiz', text: 'Se va a enviar', time: 'ahora' };
    api.posts.create.mockResolvedValue(enviada);
    api.posts.list.mockResolvedValue([enviada, POST]);
    online = true;
    await replayPass();

    await waitFor(() => expect(screen.queryByText('Pendiente de enviar')).toBeNull());
    await waitFor(() => expect(screen.getAllByText('Se va a enviar')).toHaveLength(1));
  });

  it('un borrador etiquetado no se cuela bajo otro filtro', async () => {
    online = false;
    view();
    await screen.findByText('Hola comunidad');
    fireEvent.click(screen.getByText('😊 Alegría'));
    await publicar('De alegría');
    await screen.findByText('Pendiente de enviar');

    fireEvent.click(screen.getByText('😢 Tristeza'));

    await waitFor(() => expect(screen.queryByText('Pendiente de enviar')).toBeNull());
  });
});

describe('<Comunidad /> · con conexión sigue yendo directo', () => {
  it('publica contra la API y no deja nada en la bandeja', async () => {
    view();
    await screen.findByText('Hola comunidad');

    await publicar('nueva');

    await waitFor(() => expect(api.posts.create).toHaveBeenCalledTimes(1));
    expect(await listPending()).toEqual([]);
  });

  it('pide el feed sin filtro cuando está en "todos"', async () => {
    // El cliente HTTP manda el filtro tal cual, así que 'todos' llegaba como
    // `?emotion=todos` y la API real devolvía vacío.
    view();
    await waitFor(() => expect(api.posts.list).toHaveBeenCalledWith(undefined));
  });
});

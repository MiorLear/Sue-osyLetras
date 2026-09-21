import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api';
import AdminIntroVideos from './AdminIntroVideos';

vi.mock('@/lib/api', () => ({
  api: {
    screenIntros: { list: vi.fn(), update: vi.fn(), remove: vi.fn() },
    media: { upload: vi.fn() },
  },
}));

const VIDEO = {
  id: 'v1',
  title: 'intro.mp4',
  url: '/media/screen-intros/v1.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 100,
};

function pintar() {
  return render(
    <MemoryRouter>
      <AdminIntroVideos />
    </MemoryRouter>,
  );
}

/** La tarjeta de una pantalla, por su encabezado. */
const tarjeta = (label: string) => screen.getByRole('heading', { name: label }).closest('div')!.parentElement!;

beforeEach(() => {
  vi.mocked(api.screenIntros.list).mockResolvedValue([
    { screenKey: 'learning', video: VIDEO, paragraphs: ['Uno.', 'Dos.'] },
  ]);
  vi.mocked(api.screenIntros.update).mockImplementation(async (screenKey, input) => ({
    screenKey,
    ...input,
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('<AdminIntroVideos />', () => {
  it('carga los párrafos que ya había', async () => {
    pintar();
    await waitFor(() => expect((screen.getByDisplayValue('Uno.') as HTMLTextAreaElement).tagName).toBe('TEXTAREA'));
    expect(screen.getByDisplayValue('Dos.')).toBeTruthy();
  });

  it('avisa cuando faltan párrafos para llegar a tres, sin bloquear', async () => {
    pintar();
    // El aviso sale en cada tarjeta que no llegue a tres, así que hay que
    // mirar dentro de una concreta.
    const dentro = within(tarjeta('Aprendiendo'));
    expect(await dentro.findByText(/Falta 1 párrafo\./)).toBeTruthy();
    expect(dentro.getByText(/con menos se guarda igual/)).toBeTruthy();
    // La de Bienvenida no tiene ninguno todavía.
    expect(within(tarjeta('Bienvenida')).getByText(/Faltan 3 párrafos\./)).toBeTruthy();
  });

  it('el botón de guardar está apagado hasta que algo cambia', async () => {
    pintar();
    const dentro = within(tarjeta('Aprendiendo'));
    const guardar = (await dentro.findByRole('button', { name: 'Guardar párrafos' })) as HTMLButtonElement;
    expect(guardar.disabled).toBe(true);

    fireEvent.change(screen.getByDisplayValue('Uno.'), { target: { value: 'Uno, cambiado.' } });
    expect((dentro.getByRole('button', { name: 'Guardar párrafos' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('guarda los párrafos junto con el video que ya estaba', async () => {
    pintar();
    await screen.findByDisplayValue('Uno.');
    fireEvent.change(screen.getByDisplayValue('Uno.'), { target: { value: 'Uno, cambiado.' } });
    fireEvent.click(within(tarjeta('Aprendiendo')).getByRole('button', { name: 'Guardar párrafos' }));

    await waitFor(() =>
      expect(api.screenIntros.update).toHaveBeenCalledWith('learning', {
        video: VIDEO,
        paragraphs: ['Uno, cambiado.', 'Dos.'],
      }),
    );
  });

  it('descarta los párrafos que quedaron en blanco al guardar', async () => {
    pintar();
    await screen.findByDisplayValue('Uno.');
    fireEvent.change(screen.getByDisplayValue('Dos.'), { target: { value: '   ' } });
    fireEvent.click(within(tarjeta('Aprendiendo')).getByRole('button', { name: 'Guardar párrafos' }));

    await waitFor(() =>
      expect(api.screenIntros.update).toHaveBeenCalledWith('learning', { video: VIDEO, paragraphs: ['Uno.'] }),
    );
  });

  // Antes quitar el video era un DELETE de la fila entera, lo que se habría
  // llevado el texto por delante.
  it('quitar el video conserva los párrafos', async () => {
    pintar();
    await screen.findByDisplayValue('Uno.');
    fireEvent.click(within(tarjeta('Aprendiendo')).getByRole('button', { name: 'Quitar' }));

    await waitFor(() =>
      expect(api.screenIntros.update).toHaveBeenCalledWith('learning', {
        video: null,
        paragraphs: ['Uno.', 'Dos.'],
      }),
    );
    expect(api.screenIntros.remove).not.toHaveBeenCalled();
  });

  it('una pantalla sin nada guardado empieza vacía y se puede llenar', async () => {
    pintar();
    const dentro = within(tarjeta('Bienvenida'));
    fireEvent.click(await dentro.findByRole('button', { name: /Agregar párrafo/ }));
    const campo = dentro.getAllByPlaceholderText('Escribe un párrafo…')[0];
    fireEvent.change(campo, { target: { value: 'Hola.' } });
    fireEvent.click(dentro.getByRole('button', { name: 'Guardar párrafos' }));

    await waitFor(() =>
      expect(api.screenIntros.update).toHaveBeenCalledWith('home', { video: null, paragraphs: ['Hola.'] }),
    );
  });
});

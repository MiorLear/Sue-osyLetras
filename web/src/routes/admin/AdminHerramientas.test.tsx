import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaItem, ToolBook, ToolsContent, ToolsUpdateInput } from '@explorarte/shared';

const api = vi.hoisted(() => ({
  tools: { get: vi.fn(), update: vi.fn() },
  media: { upload: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api }));

const covers = vi.hoisted(() => ({ generateAutoCover: vi.fn() }));
vi.mock('@/lib/pdf-cover', () => covers);

import AdminHerramientas from './AdminHerramientas';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toaster } from '@/components/Toaster';
import { clearToasts } from '@/components/toast-store';

const media = (id: string, mimeType = 'application/pdf'): MediaItem => ({
  id,
  title: `${id}.pdf`,
  url: `https://explorarte.app/media/tools/${id}`,
  mimeType,
  sizeBytes: 10,
});

const book = (id: string, extra: Partial<ToolBook> = {}): ToolBook => ({
  id,
  title: `Libro ${id}`,
  author: null,
  file: media(id),
  cover: null,
  autoCover: null,
  ...extra,
});

const TOOLS: ToolsContent = {
  shelves: [
    { id: 'manual', title: 'Manual ExplorArte', books: [book('m1', { autoCover: media('c1', 'image/jpeg') })] },
    { id: 'guias', title: 'Guías de actividades', books: [book('g1'), book('g2')] },
  ],
  bibliographyItems: [{ id: 'b1', title: 'Emocionario', author: 'Cristina Núñez', image: null, url: null }],
};

const view = () =>
  render(
    <MemoryRouter>
      <AdminHerramientas />
      <ConfirmDialog />
      <Toaster />
    </MemoryRouter>,
  );

/** Lo último que se mandó a PUT /tools. */
const saved = (): ToolsUpdateInput => api.tools.update.mock.calls.at(-1)![0];

const saveChanges = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

beforeEach(() => {
  vi.clearAllMocks();
  clearToasts();
  api.tools.get.mockResolvedValue(structuredClone(TOOLS));
  api.tools.update.mockImplementation(async (input: ToolsUpdateInput) => input);
});

afterEach(cleanup);

describe('<AdminHerramientas />', () => {
  it('renombra un estante, crea otro y guarda la biblioteca entera', async () => {
    view();
    fireEvent.change(await screen.findByDisplayValue('Manual ExplorArte'), { target: { value: '  Manuales  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Nuevo estante/ }));
    const inputs = screen.getAllByLabelText('Nombre del estante');
    fireEvent.change(inputs[inputs.length - 1], { target: { value: 'Cuentos' } });
    saveChanges();

    await waitFor(() => expect(api.tools.update).toHaveBeenCalledTimes(1));
    expect(saved().shelves.map((s) => s.title)).toEqual(['Manuales', 'Guías de actividades', 'Cuentos']);
    expect(saved().bibliographyItems[0].title).toBe('Emocionario');
  });

  it('no guarda un estante sin nombre, y dice cuál', async () => {
    view();
    fireEvent.change(await screen.findByDisplayValue('Guías de actividades'), { target: { value: ' ' } });
    saveChanges();
    expect(await screen.findByText('El estante 2 no tiene nombre.')).toBeTruthy();
    expect(api.tools.update).not.toHaveBeenCalled();
  });

  it('borrar un estante pide confirmación y avisa cuántos libros lleva', async () => {
    view();
    const guias = await screen.findByRole('region', { name: 'Estante Guías de actividades' });
    fireEvent.click(within(guias).getByRole('button', { name: 'Eliminar estante' }));
    expect(await screen.findByText(/Tiene 2 libros/)).toBeTruthy();
    const confirm = document.querySelector('.confirm-dialog') as HTMLElement;
    fireEvent.click(within(confirm).getByText('Eliminar estante'));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Estante Guías de actividades' })).toBeNull());
    saveChanges();
    await waitFor(() => expect(saved().shelves.map((s) => s.id)).toEqual(['manual']));
  });

  it('mueve un libro a otro estante desde su editor', async () => {
    view();
    const guias = await screen.findByRole('region', { name: 'Estante Guías de actividades' });
    fireEvent.click(within(guias).getAllByRole('button', { name: 'Editar' })[1]);
    fireEvent.change(screen.getByLabelText('Estante'), { target: { value: 'manual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar libro' }));

    // Sin pulsar "Guardar cambios": el editor guarda solo.
    await waitFor(() => expect(api.tools.update).toHaveBeenCalledTimes(1));
    expect(saved().shelves[0].books.map((b) => b.id)).toEqual(['m1', 'g2']);
    expect(saved().shelves[1].books.map((b) => b.id)).toEqual(['g1']);
  });

  it('guarda la descripción del libro, sin espacios de sobra', async () => {
    view();
    const guias = await screen.findByRole('region', { name: 'Estante Guías de actividades' });
    fireEvent.click(within(guias).getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: '  Juegos para la alegría.  ' } });
    expect(screen.getByText('27 / 1000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar libro' }));

    await waitFor(() => expect(api.tools.update).toHaveBeenCalled());
    expect(saved().shelves[1].books[0].description).toBe('Juegos para la alegría.');
  });

  it('genera las portadas que faltan con la primera página de cada PDF', async () => {
    covers.generateAutoCover.mockImplementation(async (file: MediaItem) => media(`${file.id}-portada`, 'image/jpeg'));
    view();
    expect(await screen.findByText('2 libros PDF no tienen portada automática todavía.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Generar portadas faltantes' }));

    await waitFor(() => expect(covers.generateAutoCover).toHaveBeenCalledTimes(2));
    // Se guardan solas al terminar.
    await waitFor(() => expect(api.tools.update).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('2 portadas generadas y guardadas.')).toBeTruthy();
    expect(saved().shelves[1].books.map((b) => b.autoCover?.id)).toEqual(['g1-portada', 'g2-portada']);
    // La del manual ya existía y no se tocó.
    expect(saved().shelves[0].books[0].autoCover?.id).toBe('c1');
  });

  it('una portada que no termina no impide guardar el libro', async () => {
    // La portada se queda colgada para siempre: así se veía en producción.
    covers.generateAutoCover.mockReturnValue(new Promise(() => undefined));
    api.media.upload.mockResolvedValue(media('nuevo'));
    view();
    const guias = await screen.findByRole('region', { name: 'Estante Guías de actividades' });
    fireEvent.click(within(guias).getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Generar portada con la primera página' }));
    expect(await screen.findByText('Generando la portada con la primera página…')).toBeTruthy();

    const guardar = screen.getByRole('button', { name: 'Guardar libro' }) as HTMLButtonElement;
    expect(guardar.disabled).toBe(false);
    fireEvent.click(guardar);
    await waitFor(() => expect(api.tools.update).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/se guarda sin esperar a la portada/)).toBeTruthy();
  });

  it('con cambios sin guardar, la barra lo dice y salir de la página avisa', async () => {
    view();
    fireEvent.change(await screen.findByDisplayValue('Manual ExplorArte'), { target: { value: 'Manuales' } });
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeTruthy();

    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);

    saveChanges();
    expect(await screen.findByText('Todo está guardado.')).toBeTruthy();
    const afterSave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(false);
  });

  it('si falla el guardado lo dice y los cambios siguen pendientes', async () => {
    api.tools.update.mockRejectedValue(new Error('500'));
    view();
    fireEvent.change(await screen.findByDisplayValue('Manual ExplorArte'), { target: { value: 'Manuales' } });
    saveChanges();
    expect(await screen.findByText('No se pudieron guardar los cambios. Inténtalo de nuevo.')).toBeTruthy();
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeTruthy();
  });

  it('el enlace de un libro recomendado tiene que ser http(s)', async () => {
    view();
    const url = await screen.findByLabelText('Enlace al libro');
    fireEvent.change(url, { target: { value: 'javascript:alert(1)' } });
    expect(screen.getByText('Tiene que empezar con https://')).toBeTruthy();
    saveChanges();
    expect(await screen.findByText(/El enlace de «Emocionario»/)).toBeTruthy();
    expect(api.tools.update).not.toHaveBeenCalled();

    fireEvent.change(url, { target: { value: 'https://www.editorial.com/emocionario' } });
    saveChanges();
    await waitFor(() => expect(saved().bibliographyItems[0].url).toBe('https://www.editorial.com/emocionario'));
  });
});

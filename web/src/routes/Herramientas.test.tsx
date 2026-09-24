import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaItem, ToolBook, ToolsContent } from '@explorarte/shared';

// La biblioteca que ve la docente. El lector de verdad (pdf.js + page-flip) no
// corre en jsdom y tiene su propio test: aquí basta con saber que se abre.

const api = vi.hoisted(() => ({
  tools: { get: vi.fn() },
  screenIntros: { get: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api }));

vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => true,
  isOnline: () => true,
  checkReachability: async () => true,
  subscribeNetwork: () => () => undefined,
}));

vi.mock('@/components/library/BookReader', () => ({
  default: ({ book }: { book: ToolBook }) => <div role="dialog" aria-label={`Lector: ${book.title}`} />,
}));

import Herramientas from '@/routes/Herramientas';
import { clearEverything } from '@/lib/idb';
import { setCacheUser } from '@/lib/offline-cache';

const media = (id: string, mimeType = 'application/pdf'): MediaItem => ({
  id,
  title: `${id}.pdf`,
  url: `https://explorarte.app/media/tools/${id}`,
  mimeType,
  sizeBytes: 10,
});

const book = (id: string, title: string, mimeType?: string, extra: Partial<ToolBook> = {}): ToolBook => ({
  id,
  title,
  author: null,
  file: media(id, mimeType),
  cover: null,
  autoCover: null,
  ...extra,
});

const TOOLS: ToolsContent = {
  shelves: [
    {
      id: 'manual',
      title: 'Manual ExplorArte',
      books: [book('m1', 'Manual ExplorArte', undefined, { author: 'Sueños y Letras', autoCover: media('m1-cover', 'image/jpeg'), description: 'Los tres pilares de la metodología.' })],
    },
    { id: 'vacio', title: 'Estante vacío', books: [] },
    {
      id: 'recursos',
      title: 'Recursos descargables',
      books: [book('d1', 'Fichas de trabajo', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')],
    },
  ],
  bibliographyItems: [
    { id: 'b1', title: 'Emocionario', author: 'Cristina Núñez', image: media('b1-img', 'image/jpeg'), url: 'https://www.editorial.com/emocionario' },
    { id: 'b2', title: 'Sin enlace', author: null, image: null, url: null },
  ],
};

const view = () =>
  render(
    <MemoryRouter>
      <Herramientas />
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.clearAllMocks();
  await clearEverything();
  setCacheUser('ana');
  api.tools.get.mockResolvedValue(TOOLS);
  api.screenIntros.get.mockResolvedValue({ screenKey: 'tools', video: null, paragraphs: [] });
});

afterEach(cleanup);

describe('<Herramientas /> · biblioteca', () => {
  it('pinta un estante por categoría con sus libros, y esconde los vacíos', async () => {
    view();
    const manual = await screen.findByRole('region', { name: 'Manual ExplorArte' });
    expect(within(manual).getByRole('button', { name: /Leer Manual ExplorArte, de Sueños y Letras/ })).toBeTruthy();
    expect(within(manual).getByText('1 libro')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Recursos descargables' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Estante vacío' })).toBeNull();
  });

  it('usa la portada automática cuando no hay una propia, y una de tela cuando no hay ninguna', async () => {
    const { container } = view();
    await screen.findByRole('region', { name: 'Manual ExplorArte' });
    const img = container.querySelector('.book-cover__img');
    expect(img?.getAttribute('src')).toBe(media('m1-cover').url);
    // El .docx no tiene imagen: tapa de tela con su título y el tipo.
    const recursos = screen.getByRole('region', { name: 'Recursos descargables' });
    expect(within(recursos).getByText('DOC')).toBeTruthy();
  });

  it('un PDF se abre en el lector', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: /Leer Manual ExplorArte/ }));
    expect(await screen.findByRole('dialog', { name: 'Lector: Manual ExplorArte' })).toBeTruthy();
  });

  it('lo que no es PDF se abre en el visor de archivos, con Guardar', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir Fichas de trabajo \(DOC\)/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Fichas de trabajo' });
    expect(within(dialog).getByRole('button', { name: /Guardar/ })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /Lector/ })).toBeNull();
  });

  it('la bibliografía enlaza a la página del libro en otra pestaña, sin filtrar el origen', async () => {
    view();
    const link = await screen.findByRole('link', { name: /Ver Emocionario/ });
    expect(link.getAttribute('href')).toBe('https://www.editorial.com/emocionario');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    // Sin enlace no hay botón que no lleve a ningún lado.
    expect(screen.getByText('Sin enlace')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Ver Sin enlace/ })).toBeNull();
  });

  it('al pasar por un libro su descripción entra en la ficha del estante', async () => {
    const { container } = view();
    const manual = await screen.findByRole('region', { name: 'Manual ExplorArte' });
    const aside = manual.querySelector('.shelf__aside')!;
    expect(aside.textContent).toContain('Pasa el cursor por un libro');

    fireEvent.mouseEnter(within(manual).getByRole('button', { name: /Leer Manual ExplorArte/ }));
    expect(aside.querySelector('.shelf__detail-text')?.textContent).toBe('Los tres pilares de la metodología.');
    expect(aside.textContent).toContain('Clic para leer');
    expect(manual.querySelector('.shelf__row--browsing')).toBeTruthy();

    // Al salir del estante la ficha vuelve a la pista.
    fireEvent.mouseLeave(manual.querySelector('.shelf__body')!);
    expect(aside.textContent).toContain('Pasa el cursor por un libro');
    expect(container.querySelector('.shelf__row--browsing')).toBeNull();
  });

  it('sin descripción la ficha lo dice, y lo que no es PDF invita a abrir', async () => {
    view();
    const recursos = await screen.findByRole('region', { name: 'Recursos descargables' });
    fireEvent.focus(within(recursos).getByRole('button', { name: /Abrir Fichas de trabajo/ }));
    const aside = recursos.querySelector('.shelf__aside')!;
    expect(aside.textContent).toContain('Este libro todavía no tiene descripción.');
    expect(aside.textContent).toContain('Clic para abrir');
  });

  it('la descripción también llega al lector de pantalla', async () => {
    view();
    const libro = await screen.findByRole('button', { name: /Leer Manual ExplorArte/ });
    const id = libro.getAttribute('aria-describedby');
    expect(id && document.getElementById(id)?.textContent).toBe('Los tres pilares de la metodología.');
    // La ficha es decorativa: no se anuncia dos veces.
    expect(libro.closest('section')!.querySelector('.shelf__aside')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('una respuesta con la forma vieja (sin estantes) no rompe la pantalla', async () => {
    api.tools.get.mockResolvedValue({ downloadables: [], bibliography: ['Algo'], manualDocument: null, activityGuides: [] });
    view();
    expect(await screen.findByText('Aún no hay libros en la biblioteca.')).toBeTruthy();
    expect(screen.getByText('Aún no hay bibliografía sugerida.')).toBeTruthy();
  });
});

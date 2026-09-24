import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubTopic, Topic } from '@explorarte/shared';

import { api } from '@/lib/api';
import AprendiendoTema from './AprendiendoTema';

vi.mock('@/lib/api', () => ({
  api: {
    learning: { topics: vi.fn(), progress: vi.fn(), completeStep: vi.fn(), uncompleteStep: vi.fn() },
  },
}));

const fase = (key: string, title: string): SubTopic => ({
  key,
  emoji: '🌸',
  title,
  blocks: [{ kind: 'paragraph', text: `Cuerpo de ${title}` }],
  pdfs: [],
  videos: [],
  audios: [],
});

const base = (layout: Topic['layout']): Topic => ({
  id: 'tema',
  emoji: '🧘',
  title: 'Un tema',
  layout,
  intro: [{ kind: 'paragraph', text: 'La introducción del tema.' }],
  subtopics: [fase('uno', 'Fase uno'), fase('dos', 'Fase dos')],
});

function pintar(topics: Topic[], id = 'tema') {
  vi.mocked(api.learning.topics).mockResolvedValue(topics);
  return render(
    <MemoryRouter initialEntries={[`/aprendiendo/${id}`]}>
      <Routes>
        <Route path="/aprendiendo/:topicId" element={<AprendiendoTema />} />
        <Route path="/aprendiendo" element={<p>Índice de Bienestar emocional</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.learning.progress).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('<AprendiendoTema />', () => {
  it('pinta la introducción del tema antes de su contenido', async () => {
    pintar([base('accordion')]);
    expect(await screen.findByText('La introducción del tema.')).toBeTruthy();
  });

  it('con layout «path» dibuja el mapa de fases', async () => {
    pintar([base('path')]);
    expect(await screen.findByText('0 de 2 fases')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Fase 1: Fase uno/ })).toBeTruthy();
  });

  it('con layout «slides» dibuja el mazo de tarjetas', async () => {
    pintar([base('slides')]);
    expect(await screen.findByRole('region', { name: /tarjetas/i })).toBeTruthy();
  });

  it('con layout «accordion» dibuja el acordeón de siempre', async () => {
    pintar([base('accordion')]);
    const boton = await screen.findByRole('button', { name: /Fase uno/ });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
  });

  // El CMS puede ir por delante de la app instalada. Una pantalla en blanco
  // sería mucho peor que una forma de presentación de más.
  it('un layout desconocido cae en el acordeón en vez de dejar la pantalla vacía', async () => {
    const raro = { ...base('accordion'), layout: 'timeline' as Topic['layout'] };
    pintar([raro]);
    const boton = await screen.findByRole('button', { name: /Fase uno/ });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
  });

  // Las dos salidas: la de la cabecera y la del final, que es donde se está
  // al terminar de leer. Las dos a una ruta fija, nunca a `-1`.
  it.each(['path', 'slides', 'accordion'] as const)(
    'con layout «%s» se vuelve a Bienestar emocional desde arriba y desde el final',
    async (layout) => {
      pintar([base(layout)]);
      // `findAll`: el mazo repite la introducción en su primera tarjeta.
      await screen.findAllByText('La introducción del tema.');
      const botones = screen.getAllByRole('button', { name: 'Volver a Bienestar emocional' });
      expect(botones).toHaveLength(2);
      fireEvent.click(botones[1]);
      expect(await screen.findByText('Índice de Bienestar emocional')).toBeTruthy();
    },
  );

  it('un mapa recorrido entero lo celebra al final', async () => {
    vi.mocked(api.learning.progress).mockResolvedValue([
      { topicId: 'tema', stepKey: 'uno', completedAt: '2026-09-24T10:00:00Z' },
      { topicId: 'tema', stepKey: 'dos', completedAt: '2026-09-24T10:05:00Z' },
    ]);
    pintar([base('path')]);
    expect(await screen.findByText(/Completaste el recorrido/)).toBeTruthy();
  });

  it('un mapa a medias no celebra nada', async () => {
    pintar([base('path')]);
    await screen.findByText('0 de 2 fases');
    expect(screen.queryByText(/Completaste el recorrido/)).toBeNull();
  });

  it('un id que no existe se explica en vez de romper', async () => {
    pintar([base('path')], 'no-existe');
    expect(await screen.findByText(/No encontramos este tema/)).toBeTruthy();
  });
});

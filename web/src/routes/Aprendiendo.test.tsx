import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubTopic, Topic } from '@explorarte/shared';

import { api } from '@/lib/api';
import Aprendiendo from './Aprendiendo';

vi.mock('@/lib/api', () => ({
  api: {
    learning: { topics: vi.fn(), progress: vi.fn() },
    screenIntros: { get: vi.fn() },
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

const AUTOCUIDADO: Topic = {
  id: 'autocuidado',
  emoji: '🧘',
  title: 'Practicar autocuidado',
  layout: 'path',
  intro: [{ kind: 'paragraph', text: 'Antes de cuidar a otros…' }],
  subtopics: [fase('uno', 'Cuidando mis emociones'), fase('dos', 'Cuidando mi cuerpo')],
};

const AULA: Topic = {
  id: 'aula',
  emoji: '🏫',
  title: 'Cómo acompañar emociones difíciles en el aula',
  layout: 'slides',
  intro: [],
  subtopics: [fase('estrategias', 'Estrategias prácticas')],
};

function pintar() {
  return render(
    <MemoryRouter initialEntries={['/aprendiendo']}>
      <Aprendiendo />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.learning.topics).mockResolvedValue([AUTOCUIDADO, AULA]);
  vi.mocked(api.learning.progress).mockResolvedValue([]);
  vi.mocked(api.screenIntros.get).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('<Aprendiendo />', () => {
  it('lista los temas y enlaza a cada uno', async () => {
    pintar();
    const enlace = await screen.findByRole('link', { name: /Practicar autocuidado/ });
    expect(enlace.getAttribute('href')).toBe('/aprendiendo/autocuidado');
    expect(screen.getByRole('link', { name: /Cómo acompañar/ }).getAttribute('href')).toBe('/aprendiendo/aula');
  });

  it('enseña los títulos de los subtemas sin abrir el tema', async () => {
    pintar();
    expect(await screen.findByText(/Cuidando mis emociones/)).toBeTruthy();
    expect(screen.getByText(/Cuidando mi cuerpo/)).toBeTruthy();
  });

  it('el pie dice cómo se recorre cada tema', async () => {
    pintar();
    expect(await screen.findByText('Empezar · 2 fases')).toBeTruthy();
    expect(screen.getByText('Explorar · 1 tarjeta')).toBeTruthy();
  });

  it('con una fase hecha, el pie invita a continuar por la siguiente', async () => {
    vi.mocked(api.learning.progress).mockResolvedValue([
      { topicId: 'autocuidado', stepKey: 'uno', completedAt: '2026-09-20T00:00:00.000Z' },
    ]);
    pintar();
    expect(await screen.findByText('Continuar · fase 2 de 2')).toBeTruthy();
  });

  it('pinta los párrafos que escribió la administradora', async () => {
    vi.mocked(api.screenIntros.get).mockResolvedValue({
      screenKey: 'learning',
      video: null,
      paragraphs: ['Primero.', 'Segundo.', 'Tercero.'],
    });
    pintar();
    expect(await screen.findByText('Primero.')).toBeTruthy();
    expect(screen.getByText('Segundo.')).toBeTruthy();
    expect(screen.getByText('Tercero.')).toBeTruthy();
  });

  // En producción la tabla de introducciones está vacía. Sin respaldo, el día
  // del despliegue esta tarjeta se quedaría en blanco.
  it('sin nada en el CMS, enseña el texto de respaldo', async () => {
    pintar();
    expect(await screen.findByText(/Esta sección busca fortalecer los conocimientos/)).toBeTruthy();
  });

  it('sin temas lo dice en vez de quedarse en blanco', async () => {
    vi.mocked(api.learning.topics).mockResolvedValue([]);
    pintar();
    expect(await screen.findByText('Aún no hay contenidos disponibles.')).toBeTruthy();
  });

  // El avance solo alimenta la barra de las tarjetas: si no llega, la pantalla
  // tiene que dibujarse igual.
  it('si el avance falla, los temas se siguen viendo', async () => {
    vi.mocked(api.learning.progress).mockRejectedValue(new Error('sin red'));
    pintar();
    expect(await screen.findByRole('link', { name: /Practicar autocuidado/ })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Empezar · 2 fases')).toBeTruthy());
  });
});

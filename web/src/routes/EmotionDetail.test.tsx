import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EmotionActivity } from '@explorarte/shared';

import { api } from '@/lib/api';
import EmotionDetail from './EmotionDetail';

vi.mock('@/lib/api', () => ({
  api: { emotions: { get: vi.fn() } },
}));

/**
 * Las tarjetas de actividad se rediseñaron a petición del cliente: resumen con
 * propósito, duración y edades, y al abrirla objetivo, materiales, paso a paso
 * y preguntas. La versión anterior rellenaba lo que faltaba con valores
 * plausibles ("20–30 min", "7–12 años"), y una docente planifica con eso. Lo
 * que estos tests fijan es que un campo vacío no se dibuje, nunca se invente.
 */

const COMPLETA: EmotionActivity = {
  title: 'El frasco de la calma',
  purpose: 'Dar a la tristeza un lugar seguro donde posarse.',
  duration: '15 min',
  ages: '6–9 años',
  materials: 'Un frasco, agua, purpurina.',
  steps: ['Llenar el frasco de agua', 'Añadir la purpurina', 'Mirarla caer en silencio'],
  questions: ['¿Qué sentiste al mirar el frasco?'],
};

const SOLO_NOMBRE: EmotionActivity = {
  title: 'Rincón de la calma',
  purpose: '',
  duration: '',
  ages: '',
  materials: '',
  steps: [],
  questions: [],
};

function renderWith(activities: EmotionActivity[]) {
  vi.mocked(api.emotions.get).mockResolvedValue({
    id: 'tristeza',
    name: 'Tristeza',
    emoji: '😢',
    color: '#4299E1',
    bg: '#EBF8FF',
    content: {
      description: 'La tristeza aparece ante una pérdida.',
      classroom: 'Puede verse en quietud o llanto.',
      questions: ['¿Qué haces cuando te sientes triste?'],
      activities,
      stories: [],
    },
  });
  return render(
    <MemoryRouter initialEntries={['/emociones/tristeza']}>
      <Routes>
        <Route path="/emociones/:id" element={<EmotionDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.emotions.get).mockReset();
});

afterEach(cleanup);

describe('<EmotionDetail /> · tarjetas de actividad', () => {
  it('el resumen enseña propósito, duración y edades', async () => {
    renderWith([COMPLETA]);
    await screen.findByText('El frasco de la calma');

    expect(screen.getByText('Dar a la tristeza un lugar seguro donde posarse.')).toBeTruthy();
    expect(screen.getByText('⏱ 15 min')).toBeTruthy();
    expect(screen.getByText('👧 6–9 años')).toBeTruthy();
    // El paso a paso vive detrás de "Ver actividad", no en el resumen.
    expect(screen.queryByText('Añadir la purpurina')).toBeNull();
  });

  it('"Ver actividad" despliega materiales, paso a paso y preguntas', async () => {
    renderWith([COMPLETA]);
    fireEvent.click(await screen.findByRole('button', { name: /Ver actividad/ }));

    await waitFor(() => expect(screen.getByText('Un frasco, agua, purpurina.')).toBeTruthy());
    expect(screen.getByText('Llenar el frasco de agua')).toBeTruthy();
    expect(screen.getByText('Mirarla caer en silencio')).toBeTruthy();
    expect(screen.getByText('¿Qué sentiste al mirar el frasco?')).toBeTruthy();
  });

  // El fallo que se está evitando: la versión anterior mostraba "20–30 min" y
  // "7–12 años" en toda actividad que no los trajera.
  it('una actividad sin datos no se rellena con valores inventados', async () => {
    renderWith([SOLO_NOMBRE]);
    await screen.findByText('Rincón de la calma');

    expect(screen.queryByText(/⏱/)).toBeNull();
    expect(screen.queryByText(/👧/)).toBeNull();
    expect(screen.queryByText(/min/)).toBeNull();
    expect(screen.queryByText(/años/)).toBeNull();
    expect(screen.queryByText(/lápices de colores/)).toBeNull();
  });

  it('sin nada que desplegar no se ofrece "Ver actividad"', async () => {
    renderWith([SOLO_NOMBRE]);
    await screen.findByText('Rincón de la calma');

    expect(screen.queryByRole('button', { name: /Ver actividad/ })).toBeNull();
    expect(screen.getByText('Sin detalle todavía')).toBeTruthy();
  });

  it('se puede guardar en Mis recursos', async () => {
    renderWith([COMPLETA]);
    const guardar = await screen.findByRole('button', { name: /Guardar/ });
    expect(guardar.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(guardar);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Guardada/ }).getAttribute('aria-pressed')).toBe('true'),
    );
  });
});

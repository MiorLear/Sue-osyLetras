import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubTopic, Topic } from '@explorarte/shared';

import { TopicPath } from '@/components/learning/TopicPath';
import { progressId } from '@/lib/learning-progress';

afterEach(cleanup);

const fase = (key: string, title: string, emoji: string): SubTopic => ({
  key,
  emoji,
  title,
  blocks: [{ kind: 'paragraph', text: `Contenido de ${title}.` }],
  pdfs: [],
  videos: [],
  audios: [],
});

const TEMA: Topic = {
  id: 'autocuidado',
  emoji: '🧘',
  title: 'Practicar autocuidado',
  layout: 'path',
  intro: [],
  subtopics: [
    fase('cuidando-mis-emociones', 'Cuidando mis emociones', '🌸'),
    fase('cuidando-mi-cuerpo', 'Cuidando mi cuerpo', '🌿'),
    fase('cuidando-mi-mente', 'Cuidando mi mente', '🧠'),
  ],
};

function pintar(hechas: string[] = [], pendientes: string[] = [], onToggle = vi.fn()) {
  const done = new Set(hechas.map((k) => progressId(TEMA.id, k)));
  const current = TEMA.subtopics.findIndex((s) => !done.has(progressId(TEMA.id, s.key)));
  render(
    <TopicPath
      topic={TEMA}
      done={done}
      current={current === -1 ? TEMA.subtopics.length - 1 : current}
      pendingKeys={new Set(pendientes.map((k) => progressId(TEMA.id, k)))}
      onToggle={onToggle}
    />,
  );
  return onToggle;
}

describe('<TopicPath />', () => {
  it('nombra cada fase con su estado, que es lo que un lector de pantalla anuncia', () => {
    pintar(['cuidando-mis-emociones']);
    expect(screen.getByRole('button', { name: /Fase 1: Cuidando mis emociones\. Completada/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Fase 2: Cuidando mi cuerpo\. En curso/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Fase 3: Cuidando mi mente\. Aún no empezada/ })).toBeTruthy();
  });

  it('marca la fase en curso con aria-current', () => {
    pintar(['cuidando-mis-emociones']);
    const actual = screen.getByRole('button', { name: /Fase 2/ });
    expect(actual.getAttribute('aria-current')).toBe('step');
  });

  it('cuenta las fases completadas', () => {
    pintar(['cuidando-mis-emociones', 'cuidando-mi-cuerpo']);
    expect(screen.getByText('2 de 3 fases')).toBeTruthy();
  });

  it('con todo hecho lo dice', () => {
    pintar(['cuidando-mis-emociones', 'cuidando-mi-cuerpo', 'cuidando-mi-mente']);
    expect(screen.getByText('Recorrido completo')).toBeTruthy();
  });

  it('antes de abrir nada invita a empezar', () => {
    pintar();
    expect(screen.getByText(/Toca una fase del mapa/)).toBeTruthy();
  });

  it('al tocar un nodo se abre su contenido', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: /Fase 1/ }));
    expect(screen.getByText('Contenido de Cuidando mis emociones.')).toBeTruthy();
    expect(screen.getByText('Fase 1 de 3')).toBeTruthy();
  });

  // Esto es formación docente, no un juego con recompensas: dejar una fase
  // fuera de alcance sería hostil, y sin conexión además sería falso, porque
  // el cambio que la desbloquearía está esperando en la bandeja.
  it('una fase aún no empezada SE PUEDE abrir, con una recomendación', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: /Fase 3/ }));
    expect(screen.getByText('Contenido de Cuidando mi mente.')).toBeTruthy();
    expect(screen.getByText('Te recomendamos empezar por la fase anterior.')).toBeTruthy();
  });

  it('el botón de completar conmuta y avisa a quien lo pidió', () => {
    const onToggle = pintar(['cuidando-mis-emociones']);
    fireEvent.click(screen.getByRole('button', { name: /Fase 1/ }));

    const marcar = screen.getByRole('button', { name: /Fase completada/ });
    expect(marcar.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(marcar);
    expect(onToggle).toHaveBeenCalledWith('cuidando-mis-emociones');
  });

  it('una fase sin marcar ofrece marcarla', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: /Fase 2/ }));
    const marcar = screen.getByRole('button', { name: 'Marcar esta fase como completada' });
    expect(marcar.getAttribute('aria-pressed')).toBe('false');
  });

  it('una fase con el cambio todavía en la bandeja lo dice', () => {
    pintar(['cuidando-mis-emociones'], ['cuidando-mis-emociones']);
    fireEvent.click(screen.getByRole('button', { name: /Fase 1/ }));
    expect(screen.getByText('Pendiente de enviar')).toBeTruthy();
  });

  it('un tema sin fases no dibuja el mapa', () => {
    const { container } = render(
      <TopicPath topic={{ ...TEMA, subtopics: [] }} done={new Set()} current={0} pendingKeys={new Set()} onToggle={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

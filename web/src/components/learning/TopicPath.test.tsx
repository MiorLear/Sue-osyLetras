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
    { ...fase('cuidando-mis-emociones', 'Cuidando mis emociones', '🌸'), description: 'Reconocer lo que sientes.' },
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

  it('cada fase enseña su descripción, que además la describe para el lector de pantalla', () => {
    pintar();
    const nodo = screen.getByRole('button', { name: /Fase 1: Cuidando mis emociones/ });
    expect(screen.getByText('Reconocer lo que sientes.')).toBeTruthy();
    const desc = document.getElementById(nodo.getAttribute('aria-describedby') ?? '');
    expect(desc?.textContent).toBe('Reconocer lo que sientes.');
  });

  it('una fase sin descripción se pinta igual, sin hueco ni aria-describedby', () => {
    pintar();
    const nodo = screen.getByRole('button', { name: /Fase 2: Cuidando mi cuerpo/ });
    expect(nodo.hasAttribute('aria-describedby')).toBe(false);
  });

  it('cada fase lleva un botón que dice qué toca hacer en ella', () => {
    pintar(['cuidando-mis-emociones']);
    expect(screen.getByRole('button', { name: /Fase 1/ }).textContent).toContain('Repasar');
    expect(screen.getByRole('button', { name: /Fase 2/ }).textContent).toContain('Empezar');
    expect(screen.getByRole('button', { name: /Fase 3/ }).textContent).toContain('Ver fase');
  });

  it('la fase abierta repite su descripción bajo el título', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: /Fase 1/ }));
    expect(screen.getAllByText('Reconocer lo que sientes.')).toHaveLength(2);
  });

  it('con la fase ya marcada, pasar a la siguiente es el paso principal', () => {
    pintar(['cuidando-mis-emociones']);
    fireEvent.click(screen.getByRole('button', { name: /Fase 1/ }));
    // Uno solo: el de la navegación se retira para no repetir el mismo botón.
    const siguientes = screen.getAllByRole('button', { name: /Siguiente fase: Cuidando mi cuerpo/ });
    expect(siguientes).toHaveLength(1);
    fireEvent.click(siguientes[0]);
    expect(screen.getByText('Contenido de Cuidando mi cuerpo.')).toBeTruthy();
  });

  it('en la primera fase sin marcar no queda una navegación vacía', () => {
    pintar(['cuidando-mis-emociones', 'cuidando-mi-cuerpo', 'cuidando-mi-mente']);
    fireEvent.click(screen.getByRole('button', { name: /Fase 3/ }));
    expect(screen.queryByRole('button', { name: /Siguiente fase/ })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Otras fases' })).toBeTruthy();
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

  // El bug que esto fija: con el avance dibujado como guiones sobre un trazo
  // sin escalar, Chrome pintaba la cola del camino aunque no hubiera nada hecho.
  it('sin avance no pinta ningún tramo del camino', () => {
    const { container } = render(
      <TopicPath topic={TEMA} done={new Set()} current={0} pendingKeys={new Set()} onToggle={vi.fn()} />,
    );
    const pintados = [...container.querySelectorAll('path[stroke="var(--brand)"]')].filter(
      (p) => p.getAttribute('opacity') === '1',
    );
    expect(pintados).toHaveLength(0);
  });

  it('pinta solo el tramo que sale de cada fase hecha, aunque vayan salteadas', () => {
    const done = new Set([progressId(TEMA.id, 'cuidando-mi-cuerpo')]);
    const { container } = render(
      <TopicPath topic={TEMA} done={done} current={0} pendingKeys={new Set()} onToggle={vi.fn()} />,
    );
    const tramos = [...container.querySelectorAll('path[stroke="var(--brand)"]')].map((p) => p.getAttribute('opacity'));
    expect(tramos).toEqual(['0', '1']);
  });

  it('desde una fase abierta se puede pasar a la siguiente y volver', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: /Fase 1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Siguiente fase: Cuidando mi cuerpo/ }));
    expect(screen.getByText('Contenido de Cuidando mi cuerpo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Fase anterior/ }));
    expect(screen.getByText('Contenido de Cuidando mis emociones.')).toBeTruthy();
  });

  it('un tema sin fases no dibuja el mapa', () => {
    const { container } = render(
      <TopicPath topic={{ ...TEMA, subtopics: [] }} done={new Set()} current={0} pendingKeys={new Set()} onToggle={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

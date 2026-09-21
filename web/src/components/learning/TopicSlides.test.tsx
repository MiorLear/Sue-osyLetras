import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SubTopic, Topic } from '@explorarte/shared';

import { TopicSlides } from '@/components/learning/TopicSlides';

afterEach(cleanup);

const sub = (key: string, text: string): SubTopic => ({
  key,
  emoji: '',
  title: key,
  blocks: [{ kind: 'paragraph', text }],
  pdfs: [],
  videos: [],
  audios: [],
});

const TEMA: Topic = {
  id: 'aula',
  emoji: '🏫',
  title: 'Cómo acompañar',
  layout: 'slides',
  intro: [],
  subtopics: [sub('uno', 'Primera'), sub('dos', 'Segunda'), sub('tres', 'Tercera')],
};

// La <section> lleva aria-label, asi que su rol implicito es `region`.
const deck = () => screen.getByRole('region', { name: /3 tarjetas/i });
const anuncio = () => screen.getByText(/^Tarjeta \d+ de 3/);

describe('<TopicSlides />', () => {
  it('empieza en la primera y lo anuncia', () => {
    render(<TopicSlides topic={TEMA} />);
    expect(anuncio().textContent).toContain('Tarjeta 1 de 3');
  });

  it('las flechas del teclado pasan de tarjeta', () => {
    render(<TopicSlides topic={TEMA} />);
    fireEvent.keyDown(deck(), { key: 'ArrowRight' });
    expect(anuncio().textContent).toContain('Tarjeta 2 de 3');
    fireEvent.keyDown(deck(), { key: 'ArrowLeft' });
    expect(anuncio().textContent).toContain('Tarjeta 1 de 3');
  });

  it('Home y End van a los extremos', () => {
    render(<TopicSlides topic={TEMA} />);
    fireEvent.keyDown(deck(), { key: 'End' });
    expect(anuncio().textContent).toContain('Tarjeta 3 de 3');
    fireEvent.keyDown(deck(), { key: 'Home' });
    expect(anuncio().textContent).toContain('Tarjeta 1 de 3');
  });

  // Arriba y abajo son el scroll de la página. Robarlos es el fallo de
  // accesibilidad clásico de todo carrusel.
  it('las flechas vertical no cambian de tarjeta', () => {
    render(<TopicSlides topic={TEMA} />);
    fireEvent.keyDown(deck(), { key: 'ArrowDown' });
    fireEvent.keyDown(deck(), { key: 'ArrowUp' });
    expect(anuncio().textContent).toContain('Tarjeta 1 de 3');
  });

  it('los puntos llevan a su tarjeta', () => {
    render(<TopicSlides topic={TEMA} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tarjeta 3 de 3' }));
    expect(anuncio().textContent).toContain('Tarjeta 3 de 3');
  });

  it('las tarjetas que no se ven quedan fuera del foco y del lector', () => {
    render(<TopicSlides topic={TEMA} />);
    const tarjetas = screen.getAllByRole('group', { hidden: true }).filter((n) => n.getAttribute('aria-roledescription') === 'tarjeta');
    expect(tarjetas).toHaveLength(3);
    expect(tarjetas[0].getAttribute('aria-hidden')).toBeNull();
    expect(tarjetas[1].getAttribute('aria-hidden')).toBe('true');
    expect(tarjetas[1].hasAttribute('inert')).toBe(true);
  });

  // Un mazo de contenido formativo que da la vuelta hace perder el sitio.
  it('no hay bucle: los extremos deshabilitan su flecha', () => {
    render(<TopicSlides topic={TEMA} />);
    const anterior = screen.getByRole('button', { name: 'Tarjeta anterior' }) as HTMLButtonElement;
    const siguiente = screen.getByRole('button', { name: 'Tarjeta siguiente' }) as HTMLButtonElement;
    expect(anterior.disabled).toBe(true);
    expect(siguiente.disabled).toBe(false);

    fireEvent.keyDown(deck(), { key: 'End' });
    expect((screen.getByRole('button', { name: 'Tarjeta siguiente' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('con más de ocho tarjetas los puntos se cambian por un contador', () => {
    const muchas: Topic = {
      ...TEMA,
      subtopics: Array.from({ length: 11 }, (_, i) => sub(`s${i}`, `t${i}`)),
    };
    render(<TopicSlides topic={muchas} />);
    expect(screen.getByText('1 / 11')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tarjeta 3 de 11' })).toBeNull();
  });
});

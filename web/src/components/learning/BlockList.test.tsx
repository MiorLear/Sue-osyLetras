import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { LearningBlock } from '@explorarte/shared';

import { BlockList } from '@/components/learning/BlockList';

afterEach(cleanup);

describe('<BlockList />', () => {
  it('pinta el texto de los ocho tipos', () => {
    const blocks: LearningBlock[] = [
      { kind: 'paragraph', text: 'Un párrafo.' },
      { kind: 'heading', text: '¿Por qué es importante?' },
      { kind: 'checklist', title: 'Prácticas', items: ['Dormir.'] },
      { kind: 'avoidlist', title: 'Qué evitar', items: ['Minimizar.'] },
      { kind: 'callout', title: 'Recuerda', text: 'Todas las emociones son válidas.' },
      { kind: 'reflection', questions: ['¿Cómo me siento hoy?'] },
      { kind: 'quote', text: 'Gracias por contarme.' },
      { kind: 'definitions', title: 'El mensaje', items: [{ term: 'La alegría', text: 'invita a compartir.' }] },
    ];
    render(<BlockList blocks={blocks} />);

    expect(screen.getByText('Un párrafo.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '¿Por qué es importante?' })).toBeTruthy();
    expect(screen.getByText('Dormir.')).toBeTruthy();
    expect(screen.getByText('Minimizar.')).toBeTruthy();
    expect(screen.getByText('Todas las emociones son válidas.')).toBeTruthy();
    expect(screen.getByText('¿Cómo me siento hoy?')).toBeTruthy();
    expect(screen.getByText('Gracias por contarme.')).toBeTruthy();
    expect(screen.getByText('La alegría')).toBeTruthy();
    expect(screen.getByText('invita a compartir.')).toBeTruthy();
  });

  it('un cuadro sin título se dibuja como «Recuerda»', () => {
    render(<BlockList blocks={[{ kind: 'callout', title: '', text: 'Descansar es aprender.' }]} />);
    expect(screen.getByText('Recuerda')).toBeTruthy();
  });

  // El CMS puede ir por delante de la app instalada: una pantalla en blanco
  // sería mucho peor que un bloque de menos.
  it('un kind desconocido no rompe y no pinta nada', () => {
    const futuro = { kind: 'timeline', steps: ['x'] } as unknown as LearningBlock;
    render(<BlockList blocks={[futuro, { kind: 'paragraph', text: 'Sigue aquí.' }]} />);
    expect(screen.getByText('Sigue aquí.')).toBeTruthy();
    expect(screen.queryByText('x')).toBeNull();
  });

  it('no dibuja lo que está vacío', () => {
    const { container } = render(
      <BlockList
        blocks={[
          { kind: 'paragraph', text: '   ' },
          { kind: 'checklist', title: 'Vacía', items: ['', '  '] },
          { kind: 'reflection', questions: [] },
        ]}
      />,
    );
    expect(container.textContent?.trim()).toBe('');
  });

  it('salta las entradas vacías dentro de una lista', () => {
    render(<BlockList blocks={[{ kind: 'checklist', title: 'Prácticas', items: ['Uno', '  ', 'Dos'] }]} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  // Los glifos son decoración: leerlos en voz alta ("marca de verificación
  // dormir punto") solo estorba.
  it('las viñetas ✔ y ✘ quedan fuera del árbol de accesibilidad', () => {
    const { container } = render(
      <BlockList
        blocks={[
          { kind: 'checklist', title: 'Sí', items: ['Uno'] },
          { kind: 'avoidlist', title: 'No', items: ['Dos'] },
        ]}
      />,
    );
    const ocultos = [...container.querySelectorAll('[aria-hidden="true"]')].map((n) => n.textContent);
    expect(ocultos).toContain('✔');
    expect(ocultos).toContain('✘');
  });

  it('el nivel del título se puede bajar cuando hay una cabecera encima', () => {
    render(<BlockList blocks={[{ kind: 'heading', text: 'Sección' }]} headingLevel={4} />);
    expect(screen.getByRole('heading', { level: 4, name: 'Sección' })).toBeTruthy();
  });

  it('una lista de bloques vacía no dibuja el contenedor', () => {
    const { container } = render(<BlockList blocks={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import type { LearningBlock } from '../src/types/index.js';
import { blockToText, blocksToText } from '../src/content/blocks.js';

describe('blocksToText', () => {
  it('aplana cada tipo de bloque a su texto', () => {
    expect(blockToText({ kind: 'paragraph', text: 'Hola' })).toBe('Hola');
    expect(blockToText({ kind: 'heading', text: '¿Por qué importa?' })).toBe('¿Por qué importa?');
    expect(blockToText({ kind: 'quote', text: 'Gracias por contarme.' })).toBe('Gracias por contarme.');
    expect(blockToText({ kind: 'callout', title: 'Recuerda', text: 'Todas valen.' })).toBe('Recuerda\nTodas valen.');
    expect(blockToText({ kind: 'checklist', title: 'Prácticas', items: ['Dormir.', 'Respirar.'] })).toBe(
      'Prácticas\nDormir.\nRespirar.',
    );
    expect(blockToText({ kind: 'avoidlist', title: 'Evitar', items: ['Minimizar.'] })).toBe('Evitar\nMinimizar.');
    expect(blockToText({ kind: 'reflection', questions: ['¿Cómo me siento?'] })).toBe('¿Cómo me siento?');
    expect(
      blockToText({
        kind: 'definitions',
        title: 'El mensaje',
        items: [{ term: 'La alegría', text: 'nos invita a compartir.' }],
      }),
    ).toBe('El mensaje\nLa alegría: nos invita a compartir.');
  });

  it('separa los bloques por línea en blanco y salta los vacíos', () => {
    const blocks: LearningBlock[] = [
      { kind: 'heading', text: 'Título' },
      { kind: 'paragraph', text: '   ' },
      { kind: 'paragraph', text: 'Cuerpo' },
    ];
    expect(blocksToText(blocks)).toBe('Título\n\nCuerpo');
  });

  it('salta las entradas vacías dentro de una lista', () => {
    expect(blockToText({ kind: 'checklist', title: '', items: ['Uno', '  ', 'Dos'] })).toBe('Uno\nDos');
  });

  // Un `kind` que esta versión no conoce no puede tumbar la pantalla: el CMS
  // puede ir por delante de la app instalada.
  it('devuelve cadena vacía para un kind desconocido en vez de lanzar', () => {
    const futuro = { kind: 'timeline', steps: [] } as unknown as LearningBlock;
    expect(blockToText(futuro)).toBe('');
    expect(blocksToText([futuro, { kind: 'paragraph', text: 'Sigue' }])).toBe('Sigue');
  });

  it('no deja nada suelto con una lista vacía de bloques', () => {
    expect(blocksToText([])).toBe('');
  });
});

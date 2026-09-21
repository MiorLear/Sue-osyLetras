import { describe, expect, it } from 'vitest';
import type { LearningBlock } from '@explorarte/shared';

import {
  BLOCK_KINDS,
  blankBlock,
  blockPreview,
  isBlockEmpty,
  moveItem,
  subTopicKey,
  trimBlock,
} from '@/lib/learning-blocks';

describe('blankBlock', () => {
  it('devuelve un bloque vacío de cada tipo, y todos se consideran vacíos', () => {
    for (const kind of BLOCK_KINDS) {
      const block = blankBlock(kind);
      expect(block.kind).toBe(kind);
      expect(isBlockEmpty(block)).toBe(true);
    }
  });
});

describe('isBlockEmpty', () => {
  it('un título de lista sin puntos sigue estando vacío', () => {
    // Guardarla solo llenaría el CMS de filas que no dibujan nada.
    expect(isBlockEmpty({ kind: 'checklist', title: 'Prácticas', items: ['', '  '] })).toBe(true);
    expect(isBlockEmpty({ kind: 'checklist', title: '', items: ['Dormir.'] })).toBe(false);
  });

  it('un cuadro con título pero sin cuerpo está vacío', () => {
    expect(isBlockEmpty({ kind: 'callout', title: 'Recuerda', text: '  ' })).toBe(true);
  });

  it('un tipo desconocido cuenta como vacío en vez de romper', () => {
    const futuro = { kind: 'timeline' } as unknown as LearningBlock;
    expect(isBlockEmpty(futuro)).toBe(true);
  });
});

describe('trimBlock', () => {
  it('quita los espacios de los bordes y las entradas vacías', () => {
    expect(trimBlock({ kind: 'paragraph', text: '  hola  ' })).toEqual({ kind: 'paragraph', text: 'hola' });
    expect(trimBlock({ kind: 'reflection', questions: [' ¿Y? ', '', '  '] })).toEqual({
      kind: 'reflection',
      questions: ['¿Y?'],
    });
    expect(
      trimBlock({ kind: 'definitions', title: ' X ', items: [{ term: ' A ', text: ' b ' }, { term: '', text: '' }] }),
    ).toEqual({ kind: 'definitions', title: 'X', items: [{ term: 'A', text: 'b' }] });
  });
});

describe('blockPreview', () => {
  it('resume un bloque en una línea', () => {
    expect(blockPreview({ kind: 'checklist', title: 'Prácticas', items: ['Dormir.', 'Respirar.'] })).toBe(
      'Prácticas Dormir. Respirar.',
    );
  });

  it('recorta con puntos suspensivos', () => {
    const largo = blockPreview({ kind: 'paragraph', text: 'a'.repeat(200) }, 20);
    expect(largo).toHaveLength(20);
    expect(largo.endsWith('…')).toBe(true);
  });
});

describe('moveItem', () => {
  it('mueve una posición', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });

  it('fuera de rango devuelve la MISMA lista, sin copiarla', () => {
    // Devolver una copia haría que el editor se repintara al pulsar un botón
    // que está deshabilitado precisamente porque no hay nada que mover.
    const items = ['a', 'b'];
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 1, 2)).toBe(items);
    expect(moveItem(items, 1, 1)).toBe(items);
  });
});

describe('subTopicKey', () => {
  it('pliega los acentos y la eñe, como hace la base de datos', () => {
    expect(subTopicKey('Cuidando mis emociones')).toBe('cuidando-mis-emociones');
    expect(subTopicKey('¿Qué son las emociones?')).toBe('que-son-las-emociones');
    expect(subTopicKey('Niñas, niños y adolescentes')).toBe('ninas-ninos-y-adolescentes');
  });

  it('trunca a 48 caracteres sin dejar el guion colgando', () => {
    const key = subTopicKey('Qué hacer y qué evitar cuando un estudiante expresa emociones');
    expect(key).toHaveLength(48);
    expect(key.endsWith('-')).toBe(false);
  });

  it('cae en «paso» cuando no queda nada', () => {
    expect(subTopicKey('')).toBe('paso');
    expect(subTopicKey('¿¡…!?')).toBe('paso');
  });

  it('desambigua contra las claves que ya existen', () => {
    expect(subTopicKey('Cuidando mi cuerpo', ['cuidando-mi-cuerpo'])).toBe('cuidando-mi-cuerpo-2');
    expect(subTopicKey('Cuidando mi cuerpo', ['cuidando-mi-cuerpo', 'cuidando-mi-cuerpo-2'])).toBe(
      'cuidando-mi-cuerpo-3',
    );
  });
});

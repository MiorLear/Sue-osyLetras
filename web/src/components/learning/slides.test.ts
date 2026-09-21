import { describe, expect, it } from 'vitest';
import type { LearningBlock, MediaItem, SubTopic, Topic } from '@explorarte/shared';

import { SLIDE_BUDGET, toSlides } from '@/components/learning/slides';

const par = (text: string): LearningBlock => ({ kind: 'paragraph', text });
const head = (text: string): LearningBlock => ({ kind: 'heading', text });

const media = (id: string): MediaItem => ({
  id,
  title: id,
  url: `/media/learning/${id}.pdf`,
  mimeType: 'application/pdf',
  sizeBytes: 10,
});

const sub = (key: string, blocks: LearningBlock[], pdfs: MediaItem[] = []): SubTopic => ({
  key,
  emoji: '',
  title: key,
  blocks,
  pdfs,
  videos: [],
  audios: [],
});

const topic = (subtopics: SubTopic[], intro: LearningBlock[] = []): Topic => ({
  id: 't',
  emoji: '🌱',
  title: 'Tema',
  layout: 'slides',
  intro,
  subtopics,
});

/** Todos los bloques del tema, en el orden en que la administradora los escribió. */
function allBlocks(t: Topic): LearningBlock[] {
  return [...t.intro, ...t.subtopics.flatMap((s) => s.blocks)];
}

/**
 * Lo que una tarjeta lleva, contando el título que se promovió a su cabecera.
 *
 * Un `heading` que abre tanda no se pierde: pasa a ser el título de la tarjeta
 * en vez de repetirse dentro. Para comprobar que no se pierde nada hay que
 * volver a contarlo.
 */
function blocksWithPromotedHeading(slide: { title: string; eyebrow?: string; blocks: LearningBlock[] }, original: LearningBlock[]): LearningBlock[] {
  const promovido = original.find((b) => b.kind === 'heading' && b.text === slide.title);
  return promovido ? [promovido, ...slide.blocks] : slide.blocks;
}

describe('toSlides', () => {
  // La propiedad que de verdad importa: repartir no puede perder ni duplicar.
  it('cada bloque aparece exactamente una vez, y en el mismo orden', () => {
    const t = topic(
      [
        sub('a', [par('1'), par('2'), par('3')]),
        sub('b', Array.from({ length: 14 }, (_, i) => par(`b${i}`))),
      ],
      [par('intro')],
    );
    const repartidos = toSlides(t).flatMap((s) => s.blocks);
    expect(repartidos).toEqual(allBlocks(t));
  });

  it('tampoco se pierde un título cuando pasa a encabezar su tarjeta', () => {
    const t = topic([sub('a', [par('uno'), head('Sección'), par('dos')])]);
    const original = allBlocks(t);
    const repartidos = toSlides(t).flatMap((s) => blocksWithPromotedHeading(s, original));
    expect(repartidos).toEqual(original);
  });

  it('la introducción del tema abre el mazo, con el título del tema', () => {
    const slides = toSlides(topic([sub('a', [par('x')])], [par('intro')]));
    expect(slides[0].title).toBe('Tema');
    expect(slides[0].blocks).toEqual([par('intro')]);
  });

  it('sin introducción no hay tarjeta cero', () => {
    const slides = toSlides(topic([sub('a', [par('x')])]));
    expect(slides).toHaveLength(1);
    expect(slides[0].title).toBe('a');
  });

  it('parte un subtema que no cabe y numera las partes', () => {
    const t = topic([sub('a', Array.from({ length: SLIDE_BUDGET * 3 }, (_, i) => par(`p${i}`)))]);
    const slides = toSlides(t);
    expect(slides.length).toBeGreaterThan(1);
    expect(slides[0].eyebrow).toBe(`Parte 1 de ${slides.length}`);
    expect(slides.every((s) => s.title === 'a')).toBe(true);
  });

  it('un título abre tarjeta, y pasa a ser su cabecera', () => {
    // En el material, esos títulos son las estrategias de una misma sección:
    // llamarlas "Parte 3 de 5" escondería lo que la docente está leyendo.
    const t = topic([sub('a', [par('uno'), par('dos'), head('Sección'), par('tres')])]);
    const slides = toSlides(t);
    expect(slides).toHaveLength(2);
    expect(slides[1].title).toBe('Sección');
    expect(slides[1].eyebrow).toBe('a');
    expect(slides[1].blocks).toEqual([par('tres')]);
  });

  // La viuda tipográfica: un título colgando al final de una tarjeta, sin su
  // texto, es lo peor que puede hacer un mazo.
  it('ningún título queda de último bloque de una tarjeta', () => {
    const t = topic([
      sub('a', [...Array.from({ length: SLIDE_BUDGET }, (_, i) => par(`p${i}`)), head('Cola'), par('cuerpo')]),
    ]);
    for (const slide of toSlides(t)) {
      const last = slide.blocks[slide.blocks.length - 1];
      if (slide.blocks.length > 1) expect(last.kind).not.toBe('heading');
    }
  });

  it('una lista larga cuenta más que un párrafo y fuerza el corte', () => {
    const lista: LearningBlock = { kind: 'checklist', title: 'X', items: Array.from({ length: 12 }, (_, i) => `i${i}`) };
    const slides = toSlides(topic([sub('a', [lista, par('después')])]));
    expect(slides).toHaveLength(2);
  });

  it('los archivos van en la ÚLTIMA tarjeta de su subtema', () => {
    const t = topic([sub('a', Array.from({ length: SLIDE_BUDGET * 2 }, (_, i) => par(`p${i}`)), [media('guia')])]);
    const slides = toSlides(t);
    expect(slides.length).toBeGreaterThan(1);
    expect(slides.slice(0, -1).every((s) => s.media.length === 0)).toBe(true);
    expect(slides[slides.length - 1].media).toEqual([media('guia')]);
  });

  it('un subtema sin bloques pero con archivos conserva su tarjeta', () => {
    const slides = toSlides(topic([sub('solo-media', [], [media('guia')])]));
    expect(slides).toHaveLength(1);
    expect(slides[0].media).toHaveLength(1);
  });

  it('las claves de las tarjetas no se repiten', () => {
    const t = topic(
      [
        sub('a', Array.from({ length: SLIDE_BUDGET * 2 }, (_, i) => par(`a${i}`))),
        sub('b', [par('b')]),
      ],
      [par('intro')],
    );
    const keys = toSlides(t).map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('un tema vacío no produce tarjetas', () => {
    expect(toSlides(topic([]))).toEqual([]);
  });
});

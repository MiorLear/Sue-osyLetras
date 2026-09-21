import type { LearningBlock, MediaItem, Topic } from '@explorarte/shared';

// Cómo se reparte un tema en tarjetas.
//
// Puro y en su propio módulo: la propiedad que de verdad importa —que ningún
// bloque se pierda ni se duplique al repartirlos— se prueba con una sola
// aserción y sin montar nada.

export interface Slide {
  key: string;
  title: string;
  /** "Parte 2 de 3" cuando un subtema no cupo en una sola tarjeta. */
  eyebrow?: string;
  blocks: LearningBlock[];
  media: MediaItem[];
}

/**
 * Cuánto cabe en una tarjeta.
 *
 * No son píxeles: es una medida grosera para que una lista de ocho puntos no
 * comparta tarjeta con tres párrafos. Ajustarlo cambia dónde se parte, nunca
 * qué se ve.
 */
export const SLIDE_BUDGET = 6;

function weightOf(block: LearningBlock): number {
  switch (block.kind) {
    case 'checklist':
    case 'avoidlist':
      return 1 + block.items.length * 0.5;
    case 'reflection':
      return 1 + block.questions.length * 0.5;
    case 'definitions':
      return 1 + block.items.length * 0.5;
    default:
      return 1;
  }
}

/**
 * Reparte los bloques de un subtema en tandas que quepan.
 *
 * Dos reglas, y las dos existen por cómo se lee:
 *  - un `heading` siempre abre tarjeta, salvo que ya fuera a ser el primer
 *    bloque de la actual;
 *  - y nunca puede quedarse de último, colgando al pie sin su texto.
 */
function chunk(blocks: LearningBlock[]): LearningBlock[][] {
  const groups: LearningBlock[][] = [];
  let current: LearningBlock[] = [];
  let weight = 0;

  const flush = () => {
    if (current.length > 0) groups.push(current);
    current = [];
    weight = 0;
  };

  for (const block of blocks) {
    const w = weightOf(block);
    const abreSeccion = block.kind === 'heading' && current.length > 0;
    if (abreSeccion || (current.length > 0 && weight + w > SLIDE_BUDGET)) flush();
    current.push(block);
    weight += w;
  }
  flush();

  // Un título que quedó solo al final de su tanda se lleva a la siguiente.
  for (let i = 0; i < groups.length - 1; i++) {
    const group = groups[i];
    const last = group[group.length - 1];
    if (group.length > 1 && last.kind === 'heading') {
      group.pop();
      groups[i + 1].unshift(last);
    }
  }

  return groups.filter((g) => g.length > 0);
}

/**
 * Las tarjetas de un tema: su introducción, si la tiene, y luego cada subtema
 * —partido cuando no cabe—.
 *
 * Los archivos van en la ÚLTIMA tarjeta de su subtema: es donde la docente
 * acaba de leerlo y donde tiene sentido ofrecerle el PDF.
 */
export function toSlides(topic: Topic): Slide[] {
  const slides: Slide[] = [];

  if (topic.intro.length > 0) {
    slides.push({ key: `${topic.id}--intro`, title: topic.title, blocks: topic.intro, media: [] });
  }

  for (const sub of topic.subtopics) {
    const groups = chunk(sub.blocks);
    const media = [...sub.pdfs, ...sub.videos, ...sub.audios];
    if (groups.length === 0) {
      // Un subtema sin bloques pero con archivos sigue mereciendo su tarjeta.
      if (media.length > 0 || sub.title.trim()) {
        slides.push({ key: `${topic.id}--${sub.key}`, title: sub.title, blocks: [], media });
      }
      continue;
    }
    groups.forEach((blocks, i) => {
      // Cuando la tanda abre con un título, ese título manda y el del subtema
      // pasa arriba como contexto. En el material esos títulos son las cinco
      // estrategias de una misma sección: llamarlas "Parte 3 de 5" esconde
      // justo lo que la docente está leyendo.
      const first = blocks[0];
      const encabezada = first?.kind === 'heading' ? first.text.trim() : '';
      slides.push({
        key: groups.length === 1 ? `${topic.id}--${sub.key}` : `${topic.id}--${sub.key}--${i}`,
        title: encabezada || sub.title,
        eyebrow: encabezada ? sub.title : groups.length > 1 ? `Parte ${i + 1} de ${groups.length}` : undefined,
        // El título ya está en la cabecera de la tarjeta: repetirlo dentro
        // sería leerlo dos veces seguidas.
        blocks: encabezada ? blocks.slice(1) : blocks,
        media: i === groups.length - 1 ? media : [],
      });
    });
  }

  return slides;
}

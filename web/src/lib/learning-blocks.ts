import type { LearningBlock, SubTopic } from '@explorarte/shared';
import { blockToText } from '@explorarte/shared';

// Helpers de bloques para el CMS y para la pantalla.
//
// Viven aquí y no dentro del componente por la misma razón que documenta
// `components/admin/ui.tsx`: ese módulo solo exporta componentes, y react-refresh
// avisa en cuanto deja de ser así. De paso, todo esto se prueba sin jsdom.

/** El orden en que el editor ofrece los tipos: de lo más usado a lo más raro. */
export const BLOCK_KINDS = [
  'paragraph',
  'heading',
  'checklist',
  'avoidlist',
  'callout',
  'reflection',
  'quote',
  'definitions',
] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];

/** Cómo se llama y se dibuja cada tipo en el CMS. */
export const BLOCK_LABELS: Record<BlockKind, { label: string; glyph: string; hint: string }> = {
  paragraph: { label: 'Párrafo', glyph: '¶', hint: 'Texto corrido. Los saltos de línea se respetan.' },
  heading: { label: 'Título', glyph: 'H', hint: 'Abre una sección dentro del subtema.' },
  checklist: { label: 'Lista ✔', glyph: '✔', hint: 'Prácticas, recomendaciones, cosas que hacer.' },
  avoidlist: { label: 'Lista ✘', glyph: '✘', hint: 'Lo que conviene evitar.' },
  callout: { label: 'Recuerda', glyph: '💡', hint: 'El cuadro destacado. Sin título se dibuja como «Recuerda».' },
  reflection: { label: 'Reflexión', glyph: '✎', hint: 'Preguntas para pensar al cerrar.' },
  quote: { label: 'Cita', glyph: '❝', hint: 'Una frase que la docente puede decir. Se dibuja en cursiva.' },
  definitions: { label: 'Definiciones', glyph: '≡', hint: 'Término en negrita + su explicación, en filas.' },
};

/** Un bloque vacío del tipo pedido, listo para que la administradora lo llene. */
export function blankBlock(kind: BlockKind): LearningBlock {
  switch (kind) {
    case 'paragraph':
      return { kind: 'paragraph', text: '' };
    case 'heading':
      return { kind: 'heading', text: '' };
    case 'checklist':
      return { kind: 'checklist', title: '', items: [''] };
    case 'avoidlist':
      return { kind: 'avoidlist', title: '', items: [''] };
    case 'callout':
      return { kind: 'callout', title: '', text: '' };
    case 'reflection':
      return { kind: 'reflection', questions: [''] };
    case 'quote':
      return { kind: 'quote', text: '' };
    case 'definitions':
      return { kind: 'definitions', title: '', items: [{ term: '', text: '' }] };
  }
}

/**
 * Un bloque sin nada que pintar.
 *
 * El título NO cuenta: una lista con encabezado y sin puntos no dibuja nada
 * útil, y guardarla solo llenaría el CMS de filas huecas. La regla es la misma
 * que ya aplica el resto del admin — «la app no dibuja lo que está vacío».
 */
export function isBlockEmpty(block: LearningBlock): boolean {
  switch (block.kind) {
    case 'paragraph':
    case 'heading':
    case 'quote':
      return !block.text.trim();
    case 'callout':
      return !block.text.trim();
    case 'checklist':
    case 'avoidlist':
      return block.items.every((i) => !i.trim());
    case 'reflection':
      return block.questions.every((q) => !q.trim());
    case 'definitions':
      return block.items.every((i) => !i.term.trim() && !i.text.trim());
    default:
      return true;
  }
}

/** Quita los espacios de los bordes y las entradas vacías de las listas. */
export function trimBlock(block: LearningBlock): LearningBlock {
  switch (block.kind) {
    case 'paragraph':
    case 'heading':
    case 'quote':
      return { ...block, text: block.text.trim() };
    case 'callout':
      return { ...block, title: block.title.trim(), text: block.text.trim() };
    case 'checklist':
    case 'avoidlist':
      return { ...block, title: block.title.trim(), items: block.items.map((i) => i.trim()).filter(Boolean) };
    case 'reflection':
      return { ...block, questions: block.questions.map((q) => q.trim()).filter(Boolean) };
    case 'definitions':
      return {
        ...block,
        title: block.title.trim(),
        items: block.items
          .map((i) => ({ term: i.term.trim(), text: i.text.trim() }))
          .filter((i) => i.term || i.text),
      };
    default:
      return block;
  }
}

/** La línea que el CMS enseña de un bloque cerrado. */
export function blockPreview(block: LearningBlock, max = 120): string {
  const text = blockToText(block).replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Mueve un elemento una posición. Fuera de rango devuelve la misma lista. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * La clave de un subtema nuevo. Mismo slug que `explorarte_slug()` en la base y
 * que `LearningController.slugify()` en el backend: si cambia una, cambian las
 * tres.
 *
 * Solo se llama al CREAR. Una clave ya asignada no se recalcula nunca, porque
 * es el ancla del avance guardado de cada docente.
 */
export function subTopicKey(title: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const flat = (title || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  const base =
    flat
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/g, '') || 'paso';
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) candidate = `${base}-${n++}`;
  return candidate;
}

/**
 * Un subtema en blanco.
 *
 * La clave va vacía a propósito: la asigna el servidor a partir del título al
 * guardar, y así no hay dos generadores de claves que puedan discrepar.
 */
export function blankSubTopic(): SubTopic {
  return { key: '', emoji: '', title: '', blocks: [blankBlock('paragraph')], pdfs: [], videos: [], audios: [] };
}

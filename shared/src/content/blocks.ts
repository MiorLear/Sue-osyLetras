// Aplanar bloques de Aprendiendo a texto corrido.
//
// Existe por la app de React Native, que ya no se publica pero sigue
// compilando en CI y comparte `shared/` con la PWA: su pantalla de aprendizaje
// pintaba `sub.body`, y ese campo ya no existe. Portarle el mapa de fases y las
// tarjetas sería trabajo sobre código que el equipo tiene marcado para retirar,
// así que aplana y pinta.
//
// De paso le sirve a la PWA para la línea de vista previa de cada bloque en el
// CMS, que es el mismo problema: "resume esto en texto plano".

import type { LearningBlock } from '../types/index.js';

/** El texto de un bloque suelto, sin su estructura. Vacío si no tiene ninguno. */
export function blockToText(block: LearningBlock): string {
  switch (block.kind) {
    case 'paragraph':
    case 'heading':
    case 'quote':
      return block.text.trim();
    case 'callout':
      return [block.title.trim(), block.text.trim()].filter(Boolean).join('\n');
    case 'checklist':
    case 'avoidlist':
      return [block.title.trim(), ...block.items.map((i) => i.trim())].filter(Boolean).join('\n');
    case 'reflection':
      return block.questions.map((q) => q.trim()).filter(Boolean).join('\n');
    case 'definitions':
      return [
        block.title.trim(),
        ...block.items.map((i) => [i.term.trim(), i.text.trim()].filter(Boolean).join(': ')),
      ]
        .filter(Boolean)
        .join('\n');
    default:
      // Un `kind` que esta versión no conoce. Devolver '' y no lanzar: el CMS
      // puede ir por delante de la app instalada.
      return '';
  }
}

/** Todos los bloques aplanados, separados por línea en blanco. */
export function blocksToText(blocks: LearningBlock[]): string {
  return blocks.map(blockToText).filter(Boolean).join('\n\n');
}

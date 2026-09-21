import type { CSSProperties } from 'react';
import type { LearningBlock } from '@explorarte/shared';

// El único sitio donde se decide cómo se ve cada tipo de bloque.
//
// Lo usan los tres layouts de Aprendiendo —acordeón, mapa de fases y
// tarjetas— y la introducción de un tema, así que un cambio aquí se ve en los
// cuatro sitios a la vez, que es justo lo que se quiere.

interface BlockListProps {
  blocks: LearningBlock[];
  /** Color de los numerales de "Para reflexionar". */
  accent?: string;
  /** `sm` para el acordeón, donde el bloque va sangrado dentro de una tarjeta. */
  size?: 'sm' | 'md';
  /** El nivel real del título depende de lo que haya encima en la página. */
  headingLevel?: 3 | 4;
}

const CARD: CSSProperties = {
  borderRadius: 16,
  padding: 'clamp(14px, 4vw, 18px)',
};

const LIST_TITLE: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: 'var(--text-dark)',
  marginBottom: 10,
};

function Bullets({
  title,
  items,
  glyph,
  glyphColor,
  card,
  size,
}: {
  title: string;
  items: string[];
  glyph: string;
  glyphColor: string;
  card: CSSProperties;
  size: 'sm' | 'md';
}) {
  const visible = items.filter((i) => i.trim());
  if (visible.length === 0) return null;
  return (
    <div style={{ ...CARD, ...card }}>
      {title.trim() ? <p style={LIST_TITLE}>{title}</p> : null}
      <ul aria-label={title.trim() || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 9, listStyle: 'none' }}>
        {visible.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {/* El color va en el glifo y no en el texto: #d8654a sobre #FBEAE6
                da 3,6:1 — suficiente para un glifo decorativo (WCAG 1.4.11 pide
                3:1), insuficiente para texto de 13px (pide 4,5:1). */}
            <span aria-hidden style={{ color: glyphColor, fontWeight: 800, lineHeight: 1.5, flexShrink: 0 }}>
              {glyph}
            </span>
            <span style={{ fontSize: size === 'sm' ? 13 : 13.5, lineHeight: 1.55, color: 'var(--text-body)' }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Block({
  block,
  accent,
  size,
  headingLevel,
}: {
  block: LearningBlock;
  accent: string;
  size: 'sm' | 'md';
  headingLevel: 3 | 4;
}) {
  switch (block.kind) {
    case 'paragraph': {
      if (!block.text.trim()) return null;
      return (
        <p
          style={{
            fontSize: size === 'sm' ? 13.5 : 14.5,
            lineHeight: 1.7,
            color: 'var(--text-body)',
            whiteSpace: 'pre-line',
            maxWidth: '62ch',
          }}>
          {block.text}
        </p>
      );
    }

    case 'heading': {
      if (!block.text.trim()) return null;
      const Tag = headingLevel === 3 ? 'h3' : 'h4';
      return (
        <Tag
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: size === 'sm' ? 16.5 : 19,
            fontWeight: 600,
            color: 'var(--text-dark)',
            marginTop: 6,
          }}>
          {block.text}
        </Tag>
      );
    }

    case 'checklist':
      return (
        <Bullets
          title={block.title}
          items={block.items}
          glyph="✔"
          glyphColor="var(--brand-dark)"
          card={{ background: 'var(--nav-bg)', border: '1px solid var(--border-input)' }}
          size={size}
        />
      );

    case 'avoidlist':
      return (
        <Bullets
          title={block.title}
          items={block.items}
          glyph="✘"
          glyphColor="var(--danger)"
          card={{ background: '#FBEAE6', border: '1px solid #F1CFC6' }}
          size={size}
        />
      );

    case 'callout': {
      if (!block.text.trim()) return null;
      return (
        <div
          style={{
            background: 'linear-gradient(150deg,#FBF1DA,#FFFCF6)',
            border: '1px solid var(--border-warm)',
            borderLeft: '4px solid var(--gold)',
            borderRadius: 18,
            padding: 'clamp(16px, 4.5vw, 22px)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span aria-hidden style={{ fontSize: 17 }}>
              💡
            </span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16.5, fontWeight: 600, color: 'var(--text-dark)' }}>
              {/* El documento titula estos cuadros "Recuerda" casi siempre; si
                  el CMS lo deja vacío, ese es el título que la docente espera. */}
              {block.title.trim() || 'Recuerda'}
            </span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-body)', whiteSpace: 'pre-line' }}>
            {block.text}
          </p>
        </div>
      );
    }

    case 'reflection': {
      const questions = block.questions.filter((q) => q.trim());
      if (questions.length === 0) return null;
      return (
        <div
          style={{
            background: '#fff',
            border: '1.5px dashed var(--border-input)',
            borderRadius: 18,
            padding: 'clamp(16px, 4.5vw, 22px)',
          }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              color: 'var(--brand-dark)',
              marginBottom: 12,
            }}>
            Para reflexionar
          </p>
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 12, listStyle: 'none' }}>
            {questions.map((q, i) => (
              <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                {/* El mismo numeral serif que la bibliografía de Herramientas,
                    para que la sección lea como una familia. */}
                <span
                  aria-hidden
                  style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: accent, flexShrink: 0 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-dark)' }}>{q}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    }

    case 'quote': {
      if (!block.text.trim()) return null;
      return (
        <blockquote
          style={{
            borderLeft: '3px solid var(--clay)',
            paddingLeft: 18,
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: size === 'sm' ? 15.5 : 17,
            lineHeight: 1.55,
            color: 'var(--text-dark)',
          }}>
          {block.text}
        </blockquote>
      );
    }

    case 'definitions': {
      const items = block.items.filter((i) => i.term.trim() || i.text.trim());
      if (items.length === 0) return null;
      return (
        <div style={{ ...CARD, background: '#fff', border: '1px solid var(--border)' }}>
          {block.title.trim() ? <p style={LIST_TITLE}>{block.title}</p> : null}
          <dl style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, i) => (
              <div key={i}>
                <dt style={{ display: 'inline', fontSize: 13.5, fontWeight: 700, color: 'var(--text-dark)' }}>
                  {item.term}
                </dt>{' '}
                <dd style={{ display: 'inline', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-body)' }}>
                  {item.text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }

    default:
      // Un tipo que el CMS conoce y esta versión de la app no. Se salta en
      // silencio: una pantalla en blanco sería mucho peor que un bloque menos.
      return null;
  }
}

export function BlockList({ blocks, accent = 'var(--brand)', size = 'md', headingLevel = 3 }: BlockListProps) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: size === 'sm' ? 12 : 16 }}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} accent={accent} size={size} headingLevel={headingLevel} />
      ))}
    </div>
  );
}

import { useState } from 'react';
import type { LearningBlock } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { StringListEditor } from '@/components/admin/ui';
import {
  BLOCK_KINDS,
  BLOCK_LABELS,
  blankBlock,
  blockPreview,
  moveItem,
  type BlockKind,
} from '@/lib/learning-blocks';

// El editor de contenido por bloques.
//
// Modelado sobre `ActivityListEditor`: fila cerrada con lo justo para
// reconocerla, y el detalle solo cuando se abre. Con catorce bloques en un
// subtema, tenerlos todos abiertos a la vez sería ilegible.

const AREA_STYLE = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  fontSize: 13.5,
  color: 'var(--text-dark)',
  lineHeight: 1.5,
  background: '#fff',
  border: '1.5px solid var(--border-input)',
  outline: 'none',
  resize: 'vertical',
} as const;

/** El tinte del chip de cada tipo, para poder escanear la lista de un vistazo. */
const CHIP_TINT: Record<BlockKind, { bg: string; color: string }> = {
  paragraph: { bg: 'var(--nav-bg)', color: 'var(--brand-dark)' },
  heading: { bg: 'var(--nav-bg)', color: 'var(--brand-dark)' },
  checklist: { bg: 'var(--nav-bg)', color: 'var(--brand-dark)' },
  avoidlist: { bg: '#FBEAE6', color: 'var(--danger)' },
  callout: { bg: '#FBF1DA', color: 'var(--gold)' },
  reflection: { bg: '#fff', color: 'var(--brand-dark)' },
  quote: { bg: '#F8E8DE', color: 'var(--clay-dark)' },
  definitions: { bg: '#EEEAF7', color: '#6B5BA8' },
};

function BlockFields({
  block,
  onChange,
}: {
  block: LearningBlock;
  onChange: (block: LearningBlock) => void;
}) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <textarea
          value={block.text}
          placeholder="Escribe el párrafo…"
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          style={{ ...AREA_STYLE, minHeight: 86 }}
        />
      );

    case 'heading':
      return (
        <input
          className="input"
          value={block.text}
          placeholder="Ej. ¿Por qué es importante?"
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      );

    case 'checklist':
    case 'avoidlist':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input"
            value={block.title}
            placeholder={block.kind === 'checklist' ? 'Ej. Algunas prácticas que pueden ayudarte' : 'Ej. Qué evitar'}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
          />
          <StringListEditor
            label="Puntos"
            items={block.items}
            placeholder="Escribe un punto…"
            addLabel="Agregar punto"
            onChange={(items) => onChange({ ...block, items })}
          />
        </div>
      );

    case 'callout':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="input"
            value={block.title}
            placeholder="Recuerda"
            onChange={(e) => onChange({ ...block, title: e.target.value })}
          />
          <textarea
            value={block.text}
            placeholder="Lo que conviene no olvidar…"
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            style={{ ...AREA_STYLE, minHeight: 70 }}
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Sin título se dibuja como «Recuerda».
          </span>
        </div>
      );

    case 'reflection':
      return (
        <StringListEditor
          label="Preguntas"
          items={block.questions}
          placeholder="Escribe una pregunta…"
          addLabel="Agregar pregunta"
          onChange={(questions) => onChange({ ...block, questions })}
        />
      );

    case 'quote':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={block.text}
            placeholder="Una frase que la docente puede decir…"
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            style={{ ...AREA_STYLE, minHeight: 70 }}
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Se dibuja en cursiva, con un filete a la izquierda.
          </span>
        </div>
      );

    case 'definitions': {
      const setItem = (i: number, patch: Partial<{ term: string; text: string }>) =>
        onChange({ ...block, items: block.items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input"
            value={block.title}
            placeholder="Ej. El mensaje de cada emoción"
            onChange={(e) => onChange({ ...block, title: e.target.value })}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {block.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input
                  className="input"
                  style={{ flex: '0 0 32%' }}
                  value={item.term}
                  placeholder="La alegría"
                  onChange={(e) => setItem(i, { term: e.target.value })}
                />
                <textarea
                  value={item.text}
                  placeholder="nos invita a compartir aquello que disfrutamos."
                  onChange={(e) => setItem(i, { text: e.target.value })}
                  style={{ ...AREA_STYLE, minHeight: 52 }}
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...block, items: block.items.filter((_, idx) => idx !== i) })}
                  aria-label="Eliminar definición"
                  style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBEAE6', border: '1px solid #F1CFC6' }}>
                  <Icon name="trash" size={15} color="var(--danger)" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange({ ...block, items: [...block.items, { term: '', text: '' }] })}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 10, background: '#fff', border: '1.5px dashed var(--border-input)', color: 'var(--brand-dark)', fontSize: 13, fontWeight: 700 }}>
              <Icon name="plus" size={14} color="var(--brand-dark)" /> Agregar definición
            </button>
          </div>
        </div>
      );
    }

    default:
      // Un bloque escrito por una versión más nueva del CMS. Se enseña sin
      // campos en vez de desaparecer: borrarlo por no saber editarlo sería
      // perder contenido de alguien.
      return (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          Este bloque lo creó una versión más reciente del panel. Se conserva tal cual.
        </p>
      );
  }
}

export function BlockListEditor({
  label,
  hint,
  items,
  onChange,
  minBlocks = 0,
}: {
  label: string;
  hint?: string;
  items: LearningBlock[];
  onChange: (items: LearningBlock[]) => void;
  /** Solo pinta un aviso. NUNCA bloquea el guardado. */
  minBlocks?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);

  const patchAt = (i: number, block: LearningBlock) =>
    onChange(items.map((x, idx) => (idx === i ? block : x)));
  const removeAt = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
    setOpen(null);
  };
  const move = (from: number, to: number) => {
    onChange(moveItem(items, from, to));
    setOpen(open === from ? to : open === to ? from : open);
  };
  const add = (kind: BlockKind) => {
    onChange([...items, blankBlock(kind)]);
    setOpen(items.length);
  };

  const faltan = minBlocks - items.length;

  return (
    <div>
      <label className="field-label">{label}</label>
      {hint ? (
        <p style={{ marginTop: -4, marginBottom: 10, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {hint}
        </p>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((block, i) => {
          const expanded = open === i;
          const kind = block.kind as BlockKind;
          const meta = BLOCK_LABELS[kind];
          const tint = CHIP_TINT[kind] ?? { bg: 'var(--bg)', color: 'var(--text-muted)' };
          const preview = blockPreview(block);
          return (
            <div
              key={i}
              style={{ borderRadius: 12, border: `1.5px solid ${expanded ? 'var(--brand)' : 'var(--border-input)'}`, background: '#fff' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10 }}>
                <span
                  aria-hidden
                  title={meta?.label}
                  style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, background: tint.bg, color: tint.color }}>
                  {meta?.glyph ?? '?'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="clamp-2" style={{ fontSize: 13, color: 'var(--text-dark)', lineHeight: 1.4 }}>
                    {preview || <span style={{ color: 'var(--text-faint)' }}>Sin contenido todavía</span>}
                  </p>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{meta?.label ?? block.kind}</span>
                </div>
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label="Subir bloque"
                  style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: '#fff', border: '1.5px solid var(--border-input)', opacity: i === 0 ? 0.4 : 1 }}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === items.length - 1}
                  aria-label="Bajar bloque"
                  style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: '#fff', border: '1.5px solid var(--border-input)', opacity: i === items.length - 1 ? 0.4 : 1 }}>
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : i)}
                  aria-expanded={expanded}
                  style={{ flexShrink: 0, minHeight: 38, padding: '0 12px', borderRadius: 10, background: expanded ? 'var(--nav-bg)' : '#fff', border: '1.5px solid var(--border-input)', color: 'var(--brand-dark)', fontSize: 12.5, fontWeight: 700 }}>
                  {expanded ? 'Cerrar' : 'Editar'}
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Eliminar ${meta?.label ?? 'bloque'}`}
                  style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBEAE6', border: '1px solid #F1CFC6' }}>
                  <Icon name="trash" size={15} color="var(--danger)" />
                </button>
              </div>

              {expanded ? (
                <div style={{ padding: '4px 10px 12px' }}>
                  <BlockFields block={block} onChange={(next) => patchAt(i, next)} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Ocho chips y no un desplegable: ocupan menos que un <select> abierto y
          eliminan la pregunta "¿qué opciones tengo?". Un clic añade el bloque
          del tipo correcto y lo abre.

          Cambiar el tipo de un bloque ya escrito no se soporta: borrar y volver
          a añadir son dos clics, y la alternativa sería una tabla de conversión
          con pérdida (¿qué pasa con los puntos de una lista que se vuelve
          párrafo?). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {BLOCK_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => add(kind)}
            title={BLOCK_LABELS[kind].hint}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', minHeight: 38, borderRadius: 10, background: '#fff', border: '1.5px dashed var(--border-input)', color: 'var(--brand-dark)', fontSize: 12.5, fontWeight: 700 }}>
            <Icon name="plus" size={13} color="var(--brand-dark)" /> {BLOCK_LABELS[kind].label}
          </button>
        ))}
      </div>

      {faltan > 0 ? (
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {`Falta${faltan === 1 ? '' : 'n'} ${faltan} bloque${faltan === 1 ? '' : 's'}. Se guarda igual; solo se verá más corto.`}
        </p>
      ) : null}
    </div>
  );
}

import { useState } from 'react';
import type { SubTopic } from '@explorarte/shared';
import { BlockListEditor } from '@/components/admin/BlockListEditor';
import { AdminBtn, AdminModal, MediaListEditor } from '@/components/admin/ui';
import { confirmDialog } from '@/components/confirm-store';

// El contenido de un subtema, en su propio modal encima del del tema.
//
// El modal del tema ya lleva N subtemas; con N bloques dentro de cada uno
// serían tres niveles anidados en un solo panel con scroll, y eso es
// ingobernable. Aquí se edita una sola fase, con todo su espacio.
//
// Su "Guardar" NO toca la red: escribe en el borrador del modal de abajo. La
// única llamada al servidor sigue siendo la del tema entero, porque el PUT
// reemplaza la colección de subtemas de una vez.

/**
 * Lo que cabe en el nodo del mapa sin pasar de tres líneas. La API acepta 200,
 * y el margen es para no romper un texto que ya se guardó algo más largo.
 */
export const SUBTOPIC_DESCRIPTION_MAX = 160;

export function SubTopicModal({
  subtopic,
  index,
  total,
  onSave,
  onClose,
}: {
  subtopic: SubTopic;
  index: number;
  total: number;
  onSave: (next: SubTopic) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SubTopic>(subtopic);
  const patch = (p: Partial<SubTopic>) => setDraft((d) => ({ ...d, ...p }));

  const cambiarClave = async () => {
    const ok = await confirmDialog({
      title: '¿Cambiar la clave de esta fase?',
      message:
        'La clave es a lo que apunta el avance guardado. Al cambiarla, las docentes que ya la hubieran completado la verán otra vez sin empezar.',
      confirmLabel: 'Cambiar la clave',
      tone: 'danger',
    });
    if (ok) patch({ key: '' });
  };

  return (
    <AdminModal
      title={`Subtema ${index + 1} de ${total}`}
      onClose={onClose}
      footer={
        <>
          <AdminBtn label="Cancelar" variant="outline" onClick={onClose} />
          <AdminBtn label="Aplicar" onClick={() => onSave(draft)} disabled={!draft.title.trim()} />
        </>
      }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 84, flexShrink: 0 }}>
            <label className="field-label">Emoji</label>
            <input
              className="input"
              style={{ textAlign: 'center', fontSize: 22 }}
              value={draft.emoji}
              maxLength={4}
              onChange={(e) => patch({ emoji: e.target.value })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Título</label>
            <input
              className="input"
              value={draft.title}
              placeholder="Ej. Cuidando mis emociones"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -8 }}>
          {draft.key ? (
            <>
              Clave: <code>{draft.key}</code> · el avance de las docentes apunta aquí, así que cambiar el
              título no la toca.{' '}
              <button
                type="button"
                onClick={cambiarClave}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand-dark)', fontSize: 11.5, fontWeight: 700, textDecoration: 'underline' }}>
                Cambiar
              </button>
            </>
          ) : (
            'La clave se genera del título al guardar.'
          )}
        </p>

        <div>
          <label className="field-label" htmlFor="subtopic-description">
            Descripción corta (opcional)
          </label>
          <textarea
            id="subtopic-description"
            className="input"
            value={draft.description ?? ''}
            maxLength={SUBTOPIC_DESCRIPTION_MAX}
            rows={2}
            placeholder="Ej. Reconocer y nombrar lo que sientes para responder con más calma."
            onChange={(e) => patch({ description: e.target.value })}
            style={{ resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
          />
          <p style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>En los temas con mapa de fases aparece bajo el título de la fase.</span>
            <span>
              {(draft.description ?? '').length} / {SUBTOPIC_DESCRIPTION_MAX}
            </span>
          </p>
        </div>

        <BlockListEditor
          label="Contenido"
          hint="Se dibuja en este orden. Un título abre sección; las listas, el cuadro «Recuerda» y las preguntas tienen su propia forma en la pantalla."
          items={draft.blocks}
          onChange={(blocks) => patch({ blocks })}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MediaListEditor label="PDF" items={draft.pdfs} category="learning" accept="application/pdf" onChange={(pdfs) => patch({ pdfs })} />
          <MediaListEditor label="Video" items={draft.videos} category="learning" accept="video/*" onChange={(videos) => patch({ videos })} />
          <MediaListEditor label="Audiocuento" items={draft.audios} category="learning" accept="audio/*" onChange={(audios) => patch({ audios })} />
        </div>
      </div>
    </AdminModal>
  );
}

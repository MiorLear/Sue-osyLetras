import { useState } from 'react';

import type { MediaItem, ToolBook, ToolShelf } from '@explorarte/shared';

import { AdminBtn, AdminModal, FileUploadInput } from '@/components/admin/ui';
import { confirmDialog } from '@/components/confirm-store';
import { BookCover } from '@/components/library/BookCover';
import { isPdf } from '@/components/library/book-utils';
import { generateAutoCover } from '@/lib/pdf-cover';

const BOOK_FILES =
  'application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** Un libro que todavía no tiene archivo: lo que abre "Agregar libro". */
export interface BookDraft extends Omit<ToolBook, 'file'> {
  file: MediaItem | null;
}

/** Lo mismo que acepta el API (ToolBook.description). */
const DESCRIPTION_MAX = 1000;

function titleFromFile(file: MediaItem): string {
  return file.title.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[-_]+/g, ' ').trim();
}

export function BookEditorModal({
  book,
  shelfId,
  shelves,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  book: BookDraft;
  shelfId: string;
  shelves: ToolShelf[];
  isNew: boolean;
  onSave: (book: ToolBook, shelfId: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BookDraft>(book);
  const [targetShelf, setTargetShelf] = useState(shelfId);
  const [coverState, setCoverState] = useState<'idle' | 'working' | 'failed'>('idle');
  const patch = (p: Partial<BookDraft>) => setDraft((d) => ({ ...d, ...p }));

  const onFile = async (file: MediaItem | null) => {
    if (!file) {
      patch({ file: null, autoCover: null });
      return;
    }
    // Un archivo nuevo invalida la portada automática del anterior.
    setDraft((d) => ({ ...d, file, autoCover: null, title: d.title.trim() ? d.title : titleFromFile(file) }));
    if (isPdf(file)) await makeCover(file);
  };

  const makeCover = async (file: MediaItem) => {
    setCoverState('working');
    try {
      const autoCover = await generateAutoCover(file);
      setDraft((d) => (d.file?.id === file.id ? { ...d, autoCover } : d));
      setCoverState('idle');
    } catch {
      setCoverState('failed');
    }
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: '¿Quitar este libro de la biblioteca?',
      message: 'Las docentes dejarán de verlo cuando guardes los cambios.',
      confirmLabel: 'Quitar',
      tone: 'danger',
    });
    if (ok) onDelete();
  };

  const ready = !!draft.file && !!draft.title.trim() && coverState !== 'working';
  const preview: ToolBook | null = draft.file ? { ...draft, file: draft.file } : null;

  return (
    <AdminModal
      title={isNew ? 'Agregar libro' : 'Editar libro'}
      onClose={onClose}
      footer={
        <>
          {!isNew ? <AdminBtn label="Quitar" variant="danger" onClick={remove} /> : null}
          <AdminBtn label="Cancelar" variant="outline" onClick={onClose} />
          <AdminBtn
            label="Aplicar"
            disabled={!ready}
            onClick={() =>
              draft.file &&
              onSave(
                { ...draft, file: draft.file, title: draft.title.trim(), author: draft.author?.trim() || null, description: draft.description?.trim() || null },
                targetShelf,
              )
            }
          />
        </>
      }>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <div style={{ width: 140, flexShrink: 0 }}>
          <span className="field-label">Portada</span>
          {preview ? (
            <BookCover book={preview} />
          ) : (
            <div style={{ aspectRatio: '3 / 4', borderRadius: 8, border: '1.5px dashed var(--border-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 10 }}>
              Sube el archivo primero
            </div>
          )}
          <p style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.4, color: 'var(--text-muted)' }}>
            {coverState === 'working'
              ? 'Generando la portada con la primera página…'
              : coverState === 'failed'
                ? 'No se pudo generar la portada automática. Puedes subir una imagen.'
                : draft.cover
                  ? 'Portada personalizada.'
                  : draft.autoCover
                    ? 'Primera página del PDF.'
                    : 'Portada genérica con el título.'}
          </p>
          {draft.file && isPdf(draft.file) && !draft.autoCover && coverState !== 'working' ? (
            <button type="button" onClick={() => draft.file && makeCover(draft.file)} style={{ marginTop: 4, fontSize: 12.5, fontWeight: 700, color: 'var(--brand-dark)', background: 'none', border: 0, padding: 0, minHeight: 32, textAlign: 'left' }}>
              Generar portada con la primera página
            </button>
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FileUploadInput label="Archivo (PDF, Word, Excel o PowerPoint)" item={draft.file} category="tools" accept={BOOK_FILES} onChange={onFile} />

          <div>
            <label className="field-label" htmlFor="book-title">Título</label>
            <input id="book-title" className="input" value={draft.title} maxLength={255} onChange={(e) => patch({ title: e.target.value })} placeholder="Ej. Manual ExplorArte" />
          </div>
          <div>
            <label className="field-label" htmlFor="book-author">Autor (opcional)</label>
            <input id="book-author" className="input" value={draft.author ?? ''} maxLength={255} onChange={(e) => patch({ author: e.target.value })} placeholder="Ej. Sueños y Letras" />
          </div>
          <div>
            <label className="field-label" htmlFor="book-description">Descripción (opcional)</label>
            <textarea
              id="book-description"
              className="input"
              value={draft.description ?? ''}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              placeholder="¿De qué trata? Se muestra al lado del estante cuando la docente pasa el cursor por el libro."
              onChange={(e) => patch({ description: e.target.value })}
              style={{ resize: 'vertical', minHeight: 90, lineHeight: 1.5 }}
            />
            <p style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'right' }}>
              {(draft.description ?? '').length} / {DESCRIPTION_MAX}
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="book-shelf">Estante</label>
            <select id="book-shelf" className="input" value={targetShelf} onChange={(e) => setTargetShelf(e.target.value)}>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>{s.title || 'Estante sin nombre'}</option>
              ))}
            </select>
          </div>

          <FileUploadInput
            label="Portada personalizada (opcional, imagen)"
            item={draft.cover}
            category="tools"
            accept="image/jpeg,image/png,image/webp"
            onChange={(cover) => patch({ cover })}
          />
          {draft.cover && draft.file && isPdf(draft.file) ? (
            <button type="button" onClick={() => patch({ cover: null })} style={{ alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 700, color: 'var(--brand-dark)', background: 'none', border: 0, padding: 0, minHeight: 32 }}>
              Usar la primera página del PDF
            </button>
          ) : null}
        </div>
      </div>
    </AdminModal>
  );
}

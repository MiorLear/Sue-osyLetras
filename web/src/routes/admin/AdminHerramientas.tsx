import { useEffect, useState } from 'react';

import type { BibliographyEntry, ToolBook, ToolShelf, ToolsUpdateInput } from '@explorarte/shared';

import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { BookEditorModal, type BookDraft } from '@/components/admin/BookEditorModal';
import { AdminBtn, FileUploadInput } from '@/components/admin/ui';
import { confirmDialog } from '@/components/confirm-store';
import { BookCover } from '@/components/library/BookCover';
import { isPdf } from '@/components/library/book-utils';
import { toast } from '@/components/toast-store';
import { api } from '@/lib/api';
import { generateAutoCover } from '@/lib/pdf-cover';

// El CMS de la biblioteca: estantes (crear, renombrar, ordenar, borrar), los
// libros de cada uno con su portada, y la bibliografía sugerida con imagen y
// enlace. Como el resto del CMS, todo se edita en un borrador y se guarda de una
// vez con "Guardar cambios".

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** El enlace de un libro recomendado: vacío o http(s) con dominio. */
export function bookLinkError(url: string | null): string | null {
  if (!url || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return 'Tiene que empezar con https://';
    return null;
  } catch {
    return 'No es un enlace válido. Cópialo completo, con https://';
  }
}

/** El primer problema que impediría guardar, dicho de forma que se pueda arreglar. */
function firstProblem(draft: ToolsUpdateInput): string | null {
  const unnamed = draft.shelves.findIndex((s) => !s.title.trim());
  if (unnamed >= 0) return `El estante ${unnamed + 1} no tiene nombre.`;
  for (const entry of draft.bibliographyItems) {
    if (!entry.title.trim()) return 'Hay un libro recomendado sin título.';
    const linkError = bookLinkError(entry.url);
    if (linkError) return `El enlace de «${entry.title}»: ${linkError.toLowerCase()}`;
  }
  return null;
}

type Editing = { shelfId: string; index: number | null; book: BookDraft };

export default function AdminHerramientas() {
  const [draft, setDraft] = useState<ToolsUpdateInput | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [covering, setCovering] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    api.tools.get().then((t) => setDraft({ shelves: t.shelves ?? [], bibliographyItems: t.bibliographyItems ?? [] }));
  }, []);

  const update = (fn: (d: ToolsUpdateInput) => ToolsUpdateInput) => {
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
  };
  const setShelves = (fn: (s: ToolShelf[]) => ToolShelf[]) => update((d) => ({ ...d, shelves: fn(d.shelves) }));
  const setBibliography = (fn: (b: BibliographyEntry[]) => BibliographyEntry[]) =>
    update((d) => ({ ...d, bibliographyItems: fn(d.bibliographyItems) }));

  const save = async () => {
    if (!draft) return;
    const clean: ToolsUpdateInput = {
      shelves: draft.shelves.map((s) => ({ ...s, title: s.title.trim() })),
      bibliographyItems: draft.bibliographyItems.map((b) => ({
        ...b,
        title: b.title.trim(),
        author: b.author?.trim() || null,
        url: b.url?.trim() || null,
      })),
    };
    const problem = firstProblem(clean);
    if (problem) {
      toast.error(problem, { title: 'Falta algo antes de guardar' });
      return;
    }
    setSaving(true);
    try {
      const saved = await api.tools.update(clean);
      setDraft({ shelves: saved.shelves, bibliographyItems: saved.bibliographyItems });
      setDirty(false);
      toast.success('Cambios guardados.');
    } catch {
      toast.error('No se pudieron guardar los cambios. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // ── estantes ──
  const addShelf = () => setShelves((s) => [...s, { id: newId('estante'), title: '', books: [] }]);
  const renameShelf = (id: string, title: string) =>
    setShelves((s) => s.map((x) => (x.id === id ? { ...x, title } : x)));
  const deleteShelf = async (shelf: ToolShelf) => {
    const n = shelf.books.length;
    const ok = await confirmDialog({
      title: `¿Eliminar el estante «${shelf.title || 'sin nombre'}»?`,
      message: n > 0 ? `Tiene ${n} ${n === 1 ? 'libro' : 'libros'}, que también se quitarán de la biblioteca.` : undefined,
      confirmLabel: 'Eliminar estante',
      tone: 'danger',
    });
    if (ok) setShelves((s) => s.filter((x) => x.id !== shelf.id));
  };

  // ── libros ──
  const openNewBook = (shelfId: string) =>
    setEditing({ shelfId, index: null, book: { id: newId('libro'), title: '', author: null, description: null, file: null, cover: null, autoCover: null } });
  const saveBook = (book: ToolBook, targetShelf: string) => {
    if (!editing) return;
    const { shelfId, index } = editing;
    setShelves((shelves) => {
      // Primero se saca de donde estaba; después se pone donde va. Si no cambió
      // de estante, vuelve a su mismo lugar.
      const without = shelves.map((s) =>
        s.id === shelfId && index !== null ? { ...s, books: s.books.filter((_, i) => i !== index) } : s,
      );
      return without.map((s) => {
        if (s.id !== targetShelf) return s;
        const books = [...s.books];
        if (targetShelf === shelfId && index !== null) books.splice(index, 0, book);
        else books.push(book);
        return { ...s, books };
      });
    });
    setEditing(null);
  };
  const deleteBook = () => {
    if (!editing || editing.index === null) return;
    const { shelfId, index } = editing;
    setShelves((s) => s.map((x) => (x.id === shelfId ? { ...x, books: x.books.filter((_, i) => i !== index) } : x)));
    setEditing(null);
  };
  const moveBook = (shelfId: string, from: number, to: number) =>
    setShelves((s) => s.map((x) => (x.id === shelfId ? { ...x, books: move(x.books, from, to) } : x)));

  const missingCovers = (draft?.shelves ?? []).flatMap((s) => s.books).filter((b) => isPdf(b.file) && !b.autoCover);

  const generateMissing = async () => {
    const pending = missingCovers;
    if (pending.length === 0) return;
    setCovering({ done: 0, total: pending.length });
    let failed = 0;
    // De uno en uno: cada uno baja un PDF entero, y en paralelo se come la memoria.
    for (const [i, book] of pending.entries()) {
      try {
        const autoCover = await generateAutoCover(book.file);
        setShelves((shelves) =>
          shelves.map((s) => ({ ...s, books: s.books.map((b) => (b.id === book.id ? { ...b, autoCover } : b)) })),
        );
      } catch {
        failed += 1;
      }
      setCovering({ done: i + 1, total: pending.length });
    }
    setCovering(null);
    if (failed) toast.error(`No se pudieron generar ${failed} de ${pending.length} portadas.`);
    else toast.success('Portadas generadas. Guarda los cambios para publicarlas.');
  };

  // ── bibliografía ──
  const patchEntry = (id: string, p: Partial<BibliographyEntry>) =>
    setBibliography((b) => b.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const addEntry = () => setBibliography((b) => [...b, { id: newId('bib'), title: '', author: null, image: null, url: null }]);
  const deleteEntry = async (entry: BibliographyEntry) => {
    const ok = await confirmDialog({
      title: `¿Quitar «${entry.title || 'este libro'}» de la bibliografía?`,
      confirmLabel: 'Quitar',
      tone: 'danger',
    });
    if (ok) setBibliography((b) => b.filter((x) => x.id !== entry.id));
  };

  const card = { borderRadius: 20, padding: 22, background: '#fff', border: '1px solid var(--border)', marginBottom: 16 } as const;
  const h3 = { fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' } as const;
  const smallBtn = { minWidth: 36, height: 36, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#F4EEE2', border: 0, fontSize: 14, color: 'var(--text-dark)' } as const;
  const dashedBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#fff', border: '1.5px dashed var(--border-input)', color: 'var(--brand-dark)', fontSize: 13, fontWeight: 700 } as const;

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Caja de herramientas"
        title="Administrar"
        accent="la biblioteca"
        lede="Organiza los estantes, sube los libros y sus portadas, y edita la bibliografía sugerida."
      />

      {!draft ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando…</p>
      ) : (
        <>
          {missingCovers.length > 0 ? (
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'var(--nav-bg)', borderColor: '#DCEDEA' }}>
              <span style={{ flex: 1, minWidth: 220, fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.5 }}>
                {covering
                  ? `Generando portadas… ${covering.done} de ${covering.total}`
                  : `${missingCovers.length} ${missingCovers.length === 1 ? 'libro PDF no tiene' : 'libros PDF no tienen'} portada automática todavía.`}
              </span>
              <div style={{ width: 240 }}>
                <AdminBtn label={covering ? 'Generando…' : 'Generar portadas faltantes'} onClick={generateMissing} disabled={!!covering} />
              </div>
            </div>
          ) : null}

          {draft.shelves.map((shelf, si) => (
            <section key={shelf.id} style={card} aria-label={`Estante ${shelf.title || si + 1}`}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="field-label" htmlFor={`shelf-${shelf.id}`}>Nombre del estante</label>
                  <input id={`shelf-${shelf.id}`} className="input" value={shelf.title} maxLength={120} placeholder="Ej. Guías de actividades" onChange={(e) => renameShelf(shelf.id, e.target.value)} />
                </div>
                <button type="button" style={smallBtn} aria-label="Subir estante" disabled={si === 0} onClick={() => setShelves((s) => move(s, si, si - 1))}>↑</button>
                <button type="button" style={smallBtn} aria-label="Bajar estante" disabled={si === draft.shelves.length - 1} onClick={() => setShelves((s) => move(s, si, si + 1))}>↓</button>
                <button type="button" style={{ ...smallBtn, background: '#FBEAE6' }} aria-label="Eliminar estante" onClick={() => deleteShelf(shelf)}>
                  <Icon name="trash" size={15} color="var(--danger)" />
                </button>
              </div>

              {shelf.books.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Este estante está vacío. Las docentes no lo verán hasta que tenga un libro.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                  {shelf.books.map((book, bi) => (
                    <li key={book.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div style={{ width: 44, flexShrink: 0 }}>
                        <BookCover book={book} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {book.author ? `${book.author} · ` : ''}
                          {book.cover ? 'Portada personalizada' : book.autoCover ? 'Primera página' : 'Portada genérica'}
                        </div>
                      </div>
                      <button type="button" style={smallBtn} aria-label={`Subir ${book.title}`} disabled={bi === 0} onClick={() => moveBook(shelf.id, bi, bi - 1)}>↑</button>
                      <button type="button" style={smallBtn} aria-label={`Bajar ${book.title}`} disabled={bi === shelf.books.length - 1} onClick={() => moveBook(shelf.id, bi, bi + 1)}>↓</button>
                      <button type="button" style={{ ...smallBtn, padding: '0 12px', fontWeight: 700, fontSize: 12.5, color: 'var(--brand-dark)' }} onClick={() => setEditing({ shelfId: shelf.id, index: bi, book })}>
                        Editar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" style={dashedBtn} onClick={() => openNewBook(shelf.id)}>
                <Icon name="plus" size={14} color="var(--brand-dark)" /> Agregar libro
              </button>
            </section>
          ))}

          <button type="button" style={{ ...dashedBtn, marginBottom: 26 }} onClick={addShelf}>
            <Icon name="plus" size={14} color="var(--brand-dark)" /> Nuevo estante
          </button>

          <section style={card} aria-labelledby="admin-biblio">
            <h3 id="admin-biblio" style={{ ...h3, marginBottom: 4 }}>Bibliografía sugerida</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Cada libro con su portada y el enlace a su página (editorial, tienda o biblioteca).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {draft.bibliographyItems.map((entry) => {
                const linkError = bookLinkError(entry.url);
                return (
                  <div key={entry.id} style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 14, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <div style={{ width: 200 }}>
                      <FileUploadInput label="Imagen" item={entry.image} category="tools" accept="image/jpeg,image/png,image/webp" onChange={(image) => patchEntry(entry.id, { image })} />
                    </div>
                    <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label className="field-label" htmlFor={`bib-title-${entry.id}`}>Título</label>
                        <input id={`bib-title-${entry.id}`} className="input" value={entry.title} maxLength={255} onChange={(e) => patchEntry(entry.id, { title: e.target.value })} />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`bib-author-${entry.id}`}>Autor</label>
                        <input id={`bib-author-${entry.id}`} className="input" value={entry.author ?? ''} maxLength={255} onChange={(e) => patchEntry(entry.id, { author: e.target.value })} />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`bib-url-${entry.id}`}>Enlace al libro</label>
                        <input
                          id={`bib-url-${entry.id}`}
                          className="input"
                          type="url"
                          inputMode="url"
                          value={entry.url ?? ''}
                          maxLength={2048}
                          placeholder="https://…"
                          aria-invalid={!!linkError}
                          aria-describedby={linkError ? `bib-url-err-${entry.id}` : undefined}
                          onChange={(e) => patchEntry(entry.id, { url: e.target.value })}
                        />
                        {linkError ? (
                          <p id={`bib-url-err-${entry.id}`} style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{linkError}</p>
                        ) : null}
                      </div>
                    </div>
                    <button type="button" style={{ ...smallBtn, background: '#FBEAE6', alignSelf: 'flex-start' }} aria-label={`Quitar ${entry.title || 'libro recomendado'}`} onClick={() => deleteEntry(entry)}>
                      <Icon name="trash" size={15} color="var(--danger)" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" style={{ ...dashedBtn, marginTop: 14 }} onClick={addEntry}>
              <Icon name="plus" size={14} color="var(--brand-dark)" /> Agregar libro recomendado
            </button>
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, maxWidth: 280, marginLeft: 'auto' }}>
            <AdminBtn label={saving ? 'Guardando…' : 'Guardar cambios'} onClick={save} disabled={!dirty || saving || !!covering} />
          </div>
        </>
      )}

      {editing && draft ? (
        <BookEditorModal
          book={editing.book}
          shelfId={editing.shelfId}
          shelves={draft.shelves}
          isNew={editing.index === null}
          onSave={saveBook}
          onDelete={deleteBook}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

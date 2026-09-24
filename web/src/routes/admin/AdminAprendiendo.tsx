import { useEffect, useState } from 'react';
import type { LearningBlock, SubTopic, Topic, TopicLayout } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { BlockListEditor } from '@/components/admin/BlockListEditor';
import { SubTopicModal } from '@/components/admin/SubTopicModal';
import { AdminBtn, AdminModal } from '@/components/admin/ui';
import { confirmDialog } from '@/components/confirm-store';
import { api } from '@/lib/api';
import { blankSubTopic, blockPreview, isBlockEmpty, moveItem, trimBlock } from '@/lib/learning-blocks';

const TOPIC_BG = ['#EEEAF7', '#EAF3E8', '#F8E8DE', '#FBF1DA'];

type Draft = { emoji: string; title: string; layout: TopicLayout; intro: LearningBlock[]; subtopics: SubTopic[] };

const EMPTY: Draft = { emoji: '🌱', title: '', layout: 'accordion', intro: [], subtopics: [] };

/** Las tres formas de recorrer un tema, con lo que significan para la docente. */
const LAYOUTS: { value: TopicLayout; glyph: string; label: string; desc: string }[] = [
  { value: 'accordion', glyph: '☰', label: 'Acordeón', desc: 'Subtemas que se despliegan. Lo de siempre.' },
  { value: 'path', glyph: '🗺️', label: 'Mapa de fases', desc: 'Un camino que la docente marca al completar cada fase.' },
  { value: 'slides', glyph: '🃏', label: 'Tarjetas', desc: 'El contenido se pasa tarjeta a tarjeta.' },
];

export default function AdminAprendiendo() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [editing, setEditing] = useState<Topic | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [subIndex, setSubIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => api.learning.topics().then(setTopics);
  useEffect(() => {
    load();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const openNew = () => {
    setDraft({ ...EMPTY, intro: [], subtopics: [blankSubTopic()] });
    setEditing('new');
  };
  const openEdit = (t: Topic) => {
    setDraft({
      emoji: t.emoji,
      title: t.title,
      layout: t.layout,
      intro: t.intro.map((b) => ({ ...b })),
      // Copia superficial de cada subtema: `key` viaja de vuelta intacta, que
      // es lo que mantiene enganchado el avance de cada docente.
      subtopics: t.subtopics.map((s) => ({ ...s })),
    });
    setEditing(t);
  };

  const setSub = (i: number, next: SubTopic) =>
    setDraft((d) => ({ ...d, subtopics: d.subtopics.map((s, idx) => (idx === i ? next : s)) }));
  const addSub = () => {
    setDraft((d) => ({ ...d, subtopics: [...d.subtopics, blankSubTopic()] }));
    setSubIndex(draft.subtopics.length);
  };
  const removeSub = (i: number) => setDraft((d) => ({ ...d, subtopics: d.subtopics.filter((_, idx) => idx !== i) }));
  const moveSub = (from: number, to: number) =>
    setDraft((d) => ({ ...d, subtopics: moveItem(d.subtopics, from, to) }));

  const save = async () => {
    const limpiar = (blocks: LearningBlock[]) => blocks.filter((b) => !isBlockEmpty(b)).map(trimBlock);
    const clean = {
      emoji: draft.emoji.trim() || '🌱',
      title: draft.title.trim(),
      layout: draft.layout,
      intro: limpiar(draft.intro),
      subtopics: draft.subtopics
        .filter((s) => s.title.trim() || s.blocks.some((b) => !isBlockEmpty(b)))
        .map((s) => ({
          ...s,
          title: s.title.trim(),
          emoji: s.emoji.trim(),
          // Vacía viaja como null: el servidor la guarda igual, y así el
          // borrador no manda espacios sueltos.
          description: s.description?.trim() || null,
          blocks: limpiar(s.blocks),
          pdfs: s.pdfs.filter((m) => m.url.trim()),
          videos: s.videos.filter((m) => m.url.trim()),
          audios: s.audios.filter((m) => m.url.trim()),
        })),
    };
    if (!clean.title) return;
    setSaving(true);
    try {
      if (editing === 'new') {
        await api.learning.createTopic(clean);
        showToast('Tema creado');
      } else if (editing) {
        await api.learning.updateTopic(editing.id, clean);
        showToast('Tema actualizado');
      }
      setEditing(null);
      setSubIndex(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Topic) => {
    const ok = await confirmDialog({
      title: `¿Eliminar el tema "${t.title}"?`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    await api.learning.removeTopic(t.id);
    showToast('Tema eliminado');
    load();
  };

  const layoutLabel = (l: TopicLayout) => LAYOUTS.find((x) => x.value === l)?.label ?? l;

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Aprendiendo"
        title="Temas de"
        accent="bienestar"
        lede="Crea y organiza los conceptos y estrategias que acompañan a las docentes. Cada tema elige cómo se recorre."
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 12, background: 'var(--brand-dark)', color: '#fff', fontSize: 13.5, fontWeight: 700 }}>
          <Icon name="plus" size={15} color="#fff" /> Nuevo tema
        </button>
      </div>

      {topics.map((topic, ti) => (
        <div key={topic.id} style={{ marginBottom: 14, borderRadius: 18, background: '#fff', border: '1px solid var(--border)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, background: TOPIC_BG[ti % TOPIC_BG.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{topic.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 600, color: 'var(--text-dark)' }}>{topic.title}</h3>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {layoutLabel(topic.layout)} · {topic.subtopics.length} subtema{topic.subtopics.length === 1 ? '' : 's'}
              </span>
            </div>
            <button onClick={() => openEdit(topic)} aria-label="Editar" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--nav-bg)', border: '1px solid #DCEDEA' }}>
              <Icon name="edit" size={15} color="var(--brand-dark)" />
            </button>
            <button onClick={() => remove(topic)} aria-label="Eliminar" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBEAE6', border: '1px solid #F1CFC6' }}>
              <Icon name="trash" size={15} color="var(--danger)" />
            </button>
          </div>
        </div>
      ))}

      {editing ? (
        <AdminModal
          title={editing === 'new' ? 'Nuevo tema' : 'Editar tema'}
          onClose={() => {
            setEditing(null);
            setSubIndex(null);
          }}
          footer={
            <>
              <AdminBtn label="Cancelar" variant="outline" onClick={() => setEditing(null)} />
              <AdminBtn label={saving ? 'Guardando…' : 'Guardar'} onClick={save} disabled={!draft.title.trim() || saving} />
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 84, flexShrink: 0 }}>
                <label className="field-label">Emoji</label>
                <input className="input" style={{ textAlign: 'center', fontSize: 22 }} value={draft.emoji} maxLength={4} onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Título</label>
                <input className="input" value={draft.title} placeholder="Ej. Practicar autocuidado" onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="field-label">Cómo se recorre</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {LAYOUTS.map((l) => {
                  const selected = draft.layout === l.value;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft((d) => ({ ...d, layout: l.value }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '12px 14px', minHeight: 44, borderRadius: 12, background: selected ? 'var(--nav-bg)' : '#fff', border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border-input)'}` }}>
                      <span aria-hidden style={{ fontSize: 20 }}>{l.glyph}</span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text-dark)' }}>{l.label}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{l.desc}</span>
                      </span>
                      {selected ? <Icon name="check" size={16} color="var(--brand-dark)" /> : null}
                    </button>
                  );
                })}
              </div>
              {draft.layout === 'path' ? (
                <p style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  El mapa guarda el avance de cada docente por la clave de cada subtema, así que puedes
                  reordenarlos o cambiarles el título sin perderlo.
                </p>
              ) : null}
            </div>

            <BlockListEditor
              label="Introducción del tema"
              hint="Se lee antes de los subtemas. Al menos tres párrafos hacen que la sección se sienta completa."
              items={draft.intro}
              minBlocks={3}
              onChange={(intro) => setDraft((d) => ({ ...d, intro }))}
            />

            <div>
              <label className="field-label">Subtemas</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draft.subtopics.map((sub, i) => (
                  <div key={sub.key || `nuevo-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10, borderRadius: 12, border: '1.5px solid var(--border-input)', background: '#fff' }}>
                    <span aria-hidden style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, background: 'var(--bg)' }}>
                      {sub.emoji || i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="clamp-2" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.35 }}>
                        {sub.title || <span style={{ color: 'var(--text-faint)' }}>Sin título todavía</span>}
                      </p>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {sub.blocks.length === 0
                          ? 'Sin contenido'
                          : `${sub.blocks.length} bloque${sub.blocks.length === 1 ? '' : 's'} · ${blockPreview(sub.blocks[0], 42)}`}
                      </span>
                    </div>
                    <button type="button" onClick={() => moveSub(i, i - 1)} disabled={i === 0} aria-label="Subir subtema" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: '#fff', border: '1.5px solid var(--border-input)', opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                    <button type="button" onClick={() => moveSub(i, i + 1)} disabled={i === draft.subtopics.length - 1} aria-label="Bajar subtema" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: '#fff', border: '1.5px solid var(--border-input)', opacity: i === draft.subtopics.length - 1 ? 0.4 : 1 }}>↓</button>
                    <button type="button" onClick={() => setSubIndex(i)} style={{ flexShrink: 0, minHeight: 38, padding: '0 12px', borderRadius: 10, background: '#fff', border: '1.5px solid var(--border-input)', color: 'var(--brand-dark)', fontSize: 12.5, fontWeight: 700 }}>
                      Contenido
                    </button>
                    <button type="button" onClick={() => removeSub(i)} aria-label="Eliminar subtema" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBEAE6', border: '1px solid #F1CFC6' }}>
                      <Icon name="trash" size={15} color="var(--danger)" />
                    </button>
                  </div>
                ))}
                <button onClick={addSub} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', minHeight: 38, borderRadius: 10, background: '#fff', border: '1.5px dashed var(--border-input)', color: 'var(--brand-dark)', fontSize: 13, fontWeight: 700 }}>
                  <Icon name="plus" size={14} color="var(--brand-dark)" /> Agregar subtema
                </button>
              </div>
            </div>
          </div>
        </AdminModal>
      ) : null}

      {editing && subIndex !== null && draft.subtopics[subIndex] ? (
        <SubTopicModal
          subtopic={draft.subtopics[subIndex]}
          index={subIndex}
          total={draft.subtopics.length}
          onClose={() => setSubIndex(null)}
          onSave={(next) => {
            setSub(subIndex, next);
            setSubIndex(null);
          }}
        />
      ) : null}

      {toast ? (
        <div className="toast">
          <Icon name="check-circle" size={16} color="#fff" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}

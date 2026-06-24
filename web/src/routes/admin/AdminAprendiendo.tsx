import { useEffect, useState } from 'react';
import type { SubTopic, Topic } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { AdminBtn, AdminModal } from '@/components/admin/ui';
import { api } from '@/lib/api';

const TOPIC_BG = ['#EEEAF7', '#EAF3E8', '#F8E8DE', '#FBF1DA'];

type Draft = { emoji: string; title: string; subtopics: SubTopic[] };

const EMPTY: Draft = { emoji: '🌱', title: '', subtopics: [{ title: '', body: '' }] };

export default function AdminAprendiendo() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [editing, setEditing] = useState<Topic | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
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
    setDraft({ ...EMPTY, subtopics: [{ title: '', body: '' }] });
    setEditing('new');
  };
  const openEdit = (t: Topic) => {
    setDraft({ emoji: t.emoji, title: t.title, subtopics: t.subtopics.map((s) => ({ ...s })) });
    setEditing(t);
  };

  const setSub = (i: number, patch: Partial<SubTopic>) =>
    setDraft((d) => ({ ...d, subtopics: d.subtopics.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  const addSub = () => setDraft((d) => ({ ...d, subtopics: [...d.subtopics, { title: '', body: '' }] }));
  const removeSub = (i: number) => setDraft((d) => ({ ...d, subtopics: d.subtopics.filter((_, idx) => idx !== i) }));

  const save = async () => {
    const clean: Draft = {
      emoji: draft.emoji.trim() || '🌱',
      title: draft.title.trim(),
      subtopics: draft.subtopics.filter((s) => s.title.trim() || s.body.trim()),
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
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Topic) => {
    if (!confirm(`¿Eliminar el tema "${t.title}"?`)) return;
    await api.learning.removeTopic(t.id);
    showToast('Tema eliminado');
    load();
  };

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Aprendiendo"
        title="Temas de"
        accent="bienestar"
        lede="Crea y organiza los conceptos y estrategias que acompañan a las docentes."
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
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{topic.subtopics.length} subtema{topic.subtopics.length === 1 ? '' : 's'}</span>
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
          onClose={() => setEditing(null)}
          footer={
            <>
              <AdminBtn label="Cancelar" variant="outline" onClick={() => setEditing(null)} />
              <AdminBtn label={saving ? 'Guardando…' : 'Guardar'} onClick={save} disabled={!draft.title.trim() || saving} />
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 84, flexShrink: 0 }}>
                <label className="field-label">Emoji</label>
                <input className="input" style={{ textAlign: 'center', fontSize: 22 }} value={draft.emoji} maxLength={4} onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Título</label>
                <input className="input" value={draft.title} placeholder="Ej. Regulación emocional" onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="field-label">Subtemas</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {draft.subtopics.map((sub, i) => (
                  <div key={i} style={{ borderRadius: 14, border: '1px solid var(--border)', padding: 14, background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input className="input" value={sub.title} placeholder={`Subtema ${i + 1}`} onChange={(e) => setSub(i, { title: e.target.value })} />
                      <button onClick={() => removeSub(i)} aria-label="Eliminar subtema" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBEAE6', border: '1px solid #F1CFC6' }}>
                        <Icon name="trash" size={15} color="var(--danger)" />
                      </button>
                    </div>
                    <textarea
                      value={sub.body}
                      placeholder="Descripción del subtema…"
                      onChange={(e) => setSub(i, { body: e.target.value })}
                      style={{ width: '100%', minHeight: 70, padding: '10px 14px', borderRadius: 12, fontSize: 13.5, color: 'var(--text-dark)', lineHeight: 1.5, background: '#fff', border: '1.5px solid var(--border-input)', outline: 'none', resize: 'vertical' }}
                    />
                  </div>
                ))}
                <button onClick={addSub} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 10, background: '#fff', border: '1.5px dashed var(--border-input)', color: 'var(--brand-dark)', fontSize: 13, fontWeight: 700 }}>
                  <Icon name="plus" size={14} color="var(--brand-dark)" /> Agregar subtema
                </button>
              </div>
            </div>
          </div>
        </AdminModal>
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

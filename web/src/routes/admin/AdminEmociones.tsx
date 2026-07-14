import { useEffect, useState } from 'react';
import type { Emotion, EmotionDetail } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { AdminBtn, AdminModal, MediaListEditor, StringListEditor } from '@/components/admin/ui';
import { api } from '@/lib/api';

const BLANK: EmotionDetail = {
  id: '',
  name: '',
  emoji: '🙂',
  color: '#1E7E78',
  bg: '#E7F4F2',
  content: { description: '', classroom: '', questions: [''], activities: [''], stories: [] },
};

/** kebab-case slug from the emotion name, used as the route id for new emotions */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function AdminEmociones() {
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [draft, setDraft] = useState<EmotionDetail>(BLANK);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => api.emotions.list().then(setEmotions);
  useEffect(() => {
    load();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const openNew = () => {
    setDraft({ ...BLANK, content: { ...BLANK.content, questions: [''], activities: [''], stories: [] } });
    setEditing('new');
  };

  const openEdit = async (id: string) => {
    setEditing(id);
    setLoading(true);
    try {
      const detail = await api.emotions.get(id);
      if (detail) setDraft(detail);
    } finally {
      setLoading(false);
    }
  };

  const setField = <K extends keyof EmotionDetail>(key: K, value: EmotionDetail[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setContent = (patch: Partial<EmotionDetail['content']>) =>
    setDraft((d) => ({ ...d, content: { ...d.content, ...patch } }));

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const clean: EmotionDetail = {
      ...draft,
      name,
      content: {
        ...draft.content,
        questions: draft.content.questions.map((s) => s.trim()).filter(Boolean),
        activities: draft.content.activities.map((s) => s.trim()).filter(Boolean),
        stories: draft.content.stories.filter((s) => s.url),
      },
    };
    setSaving(true);
    try {
      if (editing === 'new') {
        await api.emotions.create({ ...clean, id: slugify(name) || 'emocion-' + Date.now() });
        showToast('Emoción creada');
      } else {
        await api.emotions.update(clean.id, clean);
        showToast('Emoción actualizada');
      }
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: Emotion) => {
    if (!confirm(`¿Eliminar la emoción "${e.name}"? Esto la quita de la biblioteca de las docentes.`)) return;
    await api.emotions.remove(e.id);
    showToast('Emoción eliminada');
    load();
  };

  return (
    <div className="page">
      <Masthead
        eyebrow="Biblioteca de emociones"
        title="Administrar"
        accent="emociones"
        lede="Crea y edita las emociones de la biblioteca junto con su contenido pedagógico."
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 12, background: 'var(--brand-dark)', color: '#fff', fontSize: 13.5, fontWeight: 700 }}>
          <Icon name="plus" size={15} color="#fff" /> Nueva emoción
        </button>
      </div>

      <div className="emotion-grid">
        {emotions.map((e) => (
          <div key={e.id} style={{ position: 'relative', borderRadius: 20, padding: '26px 14px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: e.bg, border: `1px solid ${e.color}33` }}>
            <span style={{ fontSize: 46, lineHeight: 1 }}>{e.emoji}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600, color: 'var(--text-dark)' }}>{e.name}</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => openEdit(e.id)} aria-label="Editar" style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: `1px solid ${e.color}44` }}>
                <Icon name="edit" size={14} color={e.color} />
              </button>
              <button onClick={() => remove(e)} aria-label="Eliminar" style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #F1CFC6' }}>
                <Icon name="trash" size={14} color="var(--danger)" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <AdminModal
          title={editing === 'new' ? 'Nueva emoción' : 'Editar emoción'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <AdminBtn label="Cancelar" variant="outline" onClick={() => setEditing(null)} />
              <AdminBtn label={saving ? 'Guardando…' : 'Guardar'} onClick={save} disabled={!draft.name.trim() || saving || loading} />
            </>
          }>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 84, flexShrink: 0 }}>
                  <label className="field-label">Emoji</label>
                  <input className="input" style={{ textAlign: 'center', fontSize: 22 }} value={draft.emoji} maxLength={4} onChange={(ev) => setField('emoji', ev.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="field-label">Nombre</label>
                  <input className="input" value={draft.name} placeholder="Ej. Gratitud" onChange={(ev) => setField('name', ev.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <ColorField label="Color de acento" value={draft.color} onChange={(v) => setField('color', v)} />
                <ColorField label="Color de fondo" value={draft.bg} onChange={(v) => setField('bg', v)} />
              </div>

              {/* live preview */}
              <div style={{ borderRadius: 16, padding: '20px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: draft.bg, border: `1px solid ${draft.color}33` }}>
                <span style={{ fontSize: 40 }}>{draft.emoji}</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--text-dark)' }}>{draft.name || 'Vista previa'}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: draft.color }}>Explorar →</span>
              </div>

              <div>
                <label className="field-label">Descripción</label>
                <textarea value={draft.content.description} placeholder="¿Qué es esta emoción?" onChange={(ev) => setContent({ description: ev.target.value })}
                  style={{ width: '100%', minHeight: 72, padding: '10px 14px', borderRadius: 12, fontSize: 13.5, color: 'var(--text-dark)', lineHeight: 1.5, background: '#fff', border: '1.5px solid var(--border-input)', outline: 'none', resize: 'vertical' }} />
              </div>

              <div>
                <label className="field-label">En el aula</label>
                <textarea value={draft.content.classroom} placeholder="¿Cómo se manifiesta y se acompaña en el aula?" onChange={(ev) => setContent({ classroom: ev.target.value })}
                  style={{ width: '100%', minHeight: 72, padding: '10px 14px', borderRadius: 12, fontSize: 13.5, color: 'var(--text-dark)', lineHeight: 1.5, background: '#fff', border: '1.5px solid var(--border-input)', outline: 'none', resize: 'vertical' }} />
              </div>

              <StringListEditor label="Preguntas para reflexionar" items={draft.content.questions} placeholder="Escribe una pregunta…" onChange={(questions) => setContent({ questions })} />
              <StringListEditor label="Actividades sugeridas" items={draft.content.activities} placeholder="Describe una actividad…" onChange={(activities) => setContent({ activities })} />
              <MediaListEditor label="Cuentos e historias (video, audio o PDF)" items={draft.content.stories} category="emotions" onChange={(stories) => setContent({ stories })} />
            </div>
          )}
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="field-label">{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: 44, height: 42, flexShrink: 0, borderRadius: 10, border: '1.5px solid var(--border-input)', background: '#fff', padding: 3, cursor: 'pointer' }} />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

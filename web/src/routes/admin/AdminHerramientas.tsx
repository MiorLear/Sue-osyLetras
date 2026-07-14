import { useEffect, useState } from 'react';
import type { ToolsContent } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { AdminBtn, FileUploadInput, MediaListEditor, StringListEditor } from '@/components/admin/ui';
import { api } from '@/lib/api';

export default function AdminHerramientas() {
  const [tools, setTools] = useState<ToolsContent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.tools.get().then(setTools);
  }, []);

  const patch = (next: Partial<ToolsContent>) => {
    setTools((t) => (t ? { ...t, ...next } : t));
    setDirty(true);
  };

  const save = async () => {
    if (!tools) return;
    setSaving(true);
    try {
      const saved = await api.tools.update(tools);
      setTools(saved);
      setDirty(false);
      setToast('Cambios guardados');
      setTimeout(() => setToast(null), 2400);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Caja de herramientas"
        title="Administrar"
        accent="materiales"
        lede="Edita la lista de recursos descargables y la bibliografía recomendada para las docentes."
      />

      {!tools ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando…</p>
      ) : (
        <>
          <div style={{ borderRadius: 20, padding: 26, background: '#fff', border: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <span style={{ fontSize: 22 }}>📖</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>Manual ExplorArte</h3>
            </div>
            <FileUploadInput
              label="Documento principal de la metodología"
              item={tools.manualDocument}
              category="tools"
              accept="application/pdf"
              onChange={(manualDocument) => patch({ manualDocument })}
            />
          </div>

          <div style={{ borderRadius: 20, padding: 26, background: '#fff', border: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <span style={{ fontSize: 22 }}>📋</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>Guías de actividades</h3>
            </div>
            <MediaListEditor
              label="Materiales complementarios para docentes"
              items={tools.activityGuides}
              category="tools"
              onChange={(activityGuides) => patch({ activityGuides })}
            />
          </div>

          <div style={{ borderRadius: 20, padding: 26, background: '#fff', border: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <span style={{ fontSize: 22 }}>📥</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>Recursos descargables</h3>
            </div>
            <MediaListEditor
              label="Cada archivo aparece como un recurso en la caja de herramientas"
              items={tools.downloadables}
              category="tools"
              onChange={(downloadables) => patch({ downloadables })}
            />
          </div>

          <div style={{ borderRadius: 20, padding: 26, background: '#fff', border: '1px solid var(--border)', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <span style={{ fontSize: 22 }}>📚</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>Bibliografía recomendada</h3>
            </div>
            <StringListEditor
              label="Lecturas sugeridas (autor, título, año…)"
              items={tools.bibliography}
              placeholder="Ej. Bisquerra, R. — Educación emocional"
              onChange={(bibliography) => patch({ bibliography })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, maxWidth: 280, marginLeft: 'auto' }}>
            <AdminBtn label={saving ? 'Guardando…' : 'Guardar cambios'} onClick={save} disabled={!dirty || saving} />
          </div>
        </>
      )}

      {toast ? (
        <div className="toast">
          <Icon name="check-circle" size={16} color="#fff" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}

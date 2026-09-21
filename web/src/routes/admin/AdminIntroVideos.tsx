import { useEffect, useState } from 'react';
import type { MediaItem, ScreenKey } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { AdminBtn, FileUploadInput, StringListEditor } from '@/components/admin/ui';
import { api } from '@/lib/api';

// La cabecera editable de cada pantalla: sus párrafos y su video.
//
// La ruta sigue siendo /admin/videos-intro. Cambiarla rompería el marcador de
// quien ya la tenga guardada, la entrada del menú y la tarjeta del panel, a
// cambio de nada: lo que importa es lo que la administradora lee aquí, y eso
// sí cambia.

/** Al menos tres párrafos hacen que una sección se sienta completa. Es un aviso, no un muro. */
const PARAGRAPHS_HINT = 3;

const SCREENS: { key: ScreenKey; label: string; emoji: string; desc: string }[] = [
  { key: 'home', label: 'Bienvenida', emoji: '👋', desc: 'Se reproduce en la pantalla de inicio, al abrir la app.' },
  { key: 'emotions', label: 'Biblioteca de emociones', emoji: '💛', desc: 'Aparece arriba de la lista de emociones.' },
  { key: 'tools', label: 'Caja de herramientas', emoji: '🧰', desc: 'Aparece en la pantalla de herramientas.' },
  { key: 'learning', label: 'Aprendiendo', emoji: '🌱', desc: 'Aparece en la pantalla de aprendizaje.' },
];

interface Draft {
  video: MediaItem | null;
  paragraphs: string[];
  dirty: boolean;
  saving: boolean;
}

const BLANK: Draft = { video: null, paragraphs: [], dirty: false, saving: false };

export default function AdminIntroVideos() {
  const [intros, setIntros] = useState<Record<string, Draft>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.screenIntros.list().then((list) => {
      setIntros(
        Object.fromEntries(
          list.map((v) => [v.screenKey, { video: v.video, paragraphs: v.paragraphs ?? [], dirty: false, saving: false }]),
        ),
      );
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const at = (key: ScreenKey): Draft => intros[key] ?? BLANK;
  const patch = (key: ScreenKey, p: Partial<Draft>) =>
    setIntros((s) => ({ ...s, [key]: { ...(s[key] ?? BLANK), ...p } }));

  /**
   * El video se guarda al instante. Un archivo grande merece su propio aviso de
   * progreso y de error, y ya lo tiene en `FileUploadInput`.
   *
   * Quitarlo ya no es un DELETE: eso borraría también los párrafos. Es un PUT
   * con el video en nulo y el texto que hubiera.
   */
  const setVideo = async (key: ScreenKey, video: MediaItem | null) => {
    const { paragraphs } = at(key);
    patch(key, { video });
    try {
      await api.screenIntros.update(key, { video, paragraphs });
      showToast(video ? 'Video actualizado' : 'Video quitado');
    } catch {
      showToast('No se pudo guardar el cambio');
    }
  };

  /** Los párrafos van con botón: no se puede hacer un PUT por tecla pulsada. */
  const saveParagraphs = async (key: ScreenKey) => {
    const draft = at(key);
    const paragraphs = draft.paragraphs.map((p) => p.trim()).filter(Boolean);
    patch(key, { saving: true });
    try {
      await api.screenIntros.update(key, { video: draft.video, paragraphs });
      patch(key, { paragraphs, dirty: false, saving: false });
      showToast('Introducción guardada');
    } catch {
      patch(key, { saving: false });
      showToast('No se pudo guardar la introducción');
    }
  };

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Contenido"
        title="Introducción de"
        accent="cada pantalla"
        lede="El texto que abre cada sección y el video que lo acompaña. El video se guarda al subirlo; los párrafos, con el botón de cada tarjeta. Usa MP4 (720p, hasta ~30 MB)."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SCREENS.map((s) => {
          const d = at(s.key);
          const escritos = d.paragraphs.filter((p) => p.trim()).length;
          const faltan = PARAGRAPHS_HINT - escritos;
          return (
            <div key={s.key} style={{ borderRadius: 20, padding: 26, background: '#fff', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 6 }}>
                <span aria-hidden style={{ fontSize: 22 }}>{s.emoji}</span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>{s.label}</h3>
              </div>
              <p style={{ marginBottom: 18, fontSize: 12.5, color: 'var(--text-muted)' }}>{s.desc}</p>

              <FileUploadInput
                label="Video de introducción"
                item={d.video}
                category="screen-intros"
                accept="video/*"
                onChange={(video) => setVideo(s.key, video)}
              />

              <div style={{ marginTop: 20 }}>
                <StringListEditor
                  label="Párrafos de la introducción"
                  items={d.paragraphs}
                  multiline
                  placeholder="Escribe un párrafo…"
                  addLabel="Agregar párrafo"
                  onChange={(paragraphs) => patch(s.key, { paragraphs, dirty: true })}
                />
                {faltan > 0 ? (
                  <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {`Falta${faltan === 1 ? '' : 'n'} ${faltan} párrafo${faltan === 1 ? '' : 's'}. La pantalla pide al menos ${PARAGRAPHS_HINT}; con menos se guarda igual, pero la introducción se ve corta.`}
                  </p>
                ) : null}
                <div style={{ marginTop: 12 }}>
                  <AdminBtn
                    label={d.saving ? 'Guardando…' : 'Guardar párrafos'}
                    onClick={() => saveParagraphs(s.key)}
                    disabled={!d.dirty || d.saving}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast ? (
        <div className="toast">
          <Icon name="check-circle" size={16} color="#fff" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}

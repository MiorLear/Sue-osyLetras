import { useEffect, useState } from 'react';
import type { MediaItem, ScreenKey } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { FileUploadInput } from '@/components/admin/ui';
import { api } from '@/lib/api';

const SCREENS: { key: ScreenKey; label: string; emoji: string }[] = [
  { key: 'home', label: 'Bienvenida', emoji: '👋' },
  { key: 'emotions', label: 'Biblioteca de emociones', emoji: '💛' },
  { key: 'tools', label: 'Caja de herramientas', emoji: '🧰' },
  { key: 'learning', label: 'Aprendiendo', emoji: '🌱' },
];

export default function AdminIntroVideos() {
  const [videos, setVideos] = useState<Record<string, MediaItem | null>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.screenIntros.list().then((list) => {
      setVideos(Object.fromEntries(list.map((v) => [v.screenKey, v.video])));
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const setVideo = async (screenKey: ScreenKey, video: MediaItem | null) => {
    setVideos((v) => ({ ...v, [screenKey]: video }));
    try {
      if (video) {
        await api.screenIntros.update(screenKey, video);
        showToast('Video actualizado');
      } else {
        await api.screenIntros.remove(screenKey);
        showToast('Video eliminado');
      }
    } catch {
      showToast('No se pudo guardar el cambio');
    }
  };

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Contenido"
        title="Videos de"
        accent="introducción"
        lede="Sube el video que se reproduce al abrir cada sección de la app. Usa MP4 (recomendado 720p, hasta ~30 MB para que suba sin problemas)."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SCREENS.map((s) => (
          <div key={s.key} style={{ borderRadius: 20, padding: 26, background: '#fff', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <span style={{ fontSize: 22 }}>{s.emoji}</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>{s.label}</h3>
            </div>
            <FileUploadInput
              label="Video de introducción"
              item={videos[s.key] ?? null}
              category="screen-intros"
              accept="video/*"
              onChange={(video) => setVideo(s.key, video)}
            />
          </div>
        ))}
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

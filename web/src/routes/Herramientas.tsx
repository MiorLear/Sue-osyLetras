import { useState } from 'react';
import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { DownloadableMediaItem, MediaList } from '@/components/DownloadableMediaItem';
import { Masthead } from '@/components/Masthead';
import { MediaViewer } from '@/components/MediaViewer';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

export default function Herramientas() {
  const {
    data: tools,
    status,
    ageMs,
    reload,
  } = useOfflineAsync(cacheKeys.tools(), () => api.tools.get(), []);
  const { data: intro } = useOfflineAsync(
    cacheKeys.screenIntro('tools'),
    () => api.screenIntros.get('tools'),
    [],
  );
  const videoUrl = intro?.video.url ?? null;
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className="page">
      <Masthead
        eyebrow="Caja de herramientas"
        title="Materiales para"
        accent="la práctica"
        lede="Manuales, guías descargables y bibliografía para implementar la metodología ExplorArte."
      />

      <CacheAgeNote status={status} ageMs={ageMs} />

      {videoUrl ? (
        <button
          onClick={() => setVideoOpen(true)}
          style={{ position: 'relative', width: '100%', borderRadius: 20, overflow: 'hidden', background: '#1E7E78', minHeight: 150, textAlign: 'left', marginBottom: 16, border: 'none', cursor: 'pointer' }}>
          <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(13,60,57,.15),rgba(13,60,57,.78))' }} />
          <span style={{ position: 'absolute', top: 18, right: 24, fontSize: 82, opacity: 0.22 }}>🧰</span>
          <span style={{ position: 'absolute', left: 24, bottom: 20, right: 24, color: '#fff' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,.92)', color: '#1E7E78', fontSize: 17, marginBottom: 10 }}>▶</span>
            <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 19 }}>Cómo usar los recursos disponibles</span>
            <span style={{ display: 'block', fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>Video de introducción · ~1 min</span>
          </span>
        </button>
      ) : null}

      {videoOpen && intro?.video ? (
        <MediaViewer item={intro.video} onClose={() => setVideoOpen(false)} />
      ) : null}

      {tools ? (
        <>
          {/* feature cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ borderRadius: 20, padding: 24, background: 'linear-gradient(150deg,#FBF1DA,#F8E8DE)', border: '1px solid #F0DEC8', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ width: 52, height: 52, borderRadius: 15, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📖</span>
              <span>
                <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>Manual ExplorArte</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 13, color: '#6A7C78', lineHeight: 1.5 }}>Documento principal de la metodología.</span>
              </span>
              {tools.manualDocument ? (
                <div style={{ marginTop: 'auto', width: '100%' }}>
                  <DownloadableMediaItem item={tools.manualDocument} />
                </div>
              ) : (
                <span style={{ marginTop: 'auto', fontSize: 12.5, color: '#8A9A96' }}>Aún no disponible</span>
              )}
            </div>
            <div style={{ borderRadius: 20, padding: 24, background: 'var(--nav-bg)', border: '1px solid #DCEDEA', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ width: 52, height: 52, borderRadius: 15, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📋</span>
              <span>
                <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>Guías de actividades</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 13, color: '#6A7C78', lineHeight: 1.5 }}>Materiales complementarios para docentes.</span>
              </span>
              {tools.activityGuides.length > 0 ? (
                <div style={{ marginTop: 'auto', width: '100%' }}>
                  <MediaList items={tools.activityGuides} />
                </div>
              ) : (
                <span style={{ marginTop: 'auto', fontSize: 12.5, color: '#8A9A96' }}>Aún no disponibles</span>
              )}
            </div>
          </div>

          {/* downloadables */}
          <div style={{ borderRadius: 20, padding: 26, background: '#fff', border: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>📥</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>Recursos descargables</h3>
            </div>
            {tools.downloadables.length === 0 ? (
              <p style={{ fontSize: 13, color: '#8A9A96' }}>Aún no hay recursos subidos.</p>
            ) : (
              <MediaList items={tools.downloadables} />
            )}
          </div>

          {/* bibliografía */}
          <div style={{ borderRadius: 20, padding: 26, background: '#fff', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>📚</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>Bibliografía recomendada</h3>
            </div>
            <p style={{ fontSize: 13, color: '#6A7C78', marginBottom: 16, lineHeight: 1.5 }}>
              Selección de lecturas para profundizar en bienestar emocional y desarrollo socioemocional.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tools.bibliography.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no hay bibliografía recomendada.</p>
              ) : (
                tools.bibliography.map((b, i) => (
                  <div key={b} style={{ display: 'flex', gap: 13, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15, color: '#C5895F', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ flex: 1, fontSize: 14, color: '#3F5450', lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <ContentState status={status} onRetry={reload} what="las herramientas" />
      )}
    </div>
  );
}

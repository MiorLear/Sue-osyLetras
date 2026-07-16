import { useState } from 'react';
import { Masthead } from '@/components/Masthead';
import { VideoModal } from '@/components/VideoModal';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';

export default function Herramientas() {
  const { data: tools, loading, error, reload } = useAsync(() => api.tools.get(), []);
  const { data: videoUrl } = useAsync(
    () => api.screenIntros.get('tools').then((v) => v?.video.url ?? null),
    [],
  );
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className="page">
      <Masthead
        eyebrow="Caja de herramientas"
        title="Materiales para"
        accent="la práctica"
        lede="Manuales, guías descargables y bibliografía para implementar la metodología ExplorArte."
      />

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

      {videoOpen && videoUrl ? <VideoModal videoUrl={videoUrl} onClose={() => setVideoOpen(false)} /> : null}

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
                <a href={tools.manualDocument.url} target="_blank" rel="noreferrer" style={{ marginTop: 'auto', alignSelf: 'flex-start', padding: '11px 18px', borderRadius: 12, background: 'var(--brand-dark)', color: '#fff', fontSize: 13, fontWeight: 700 }}>⬇ Descargar PDF</a>
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
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  {tools.activityGuides.map((g) => (
                    <a key={g.id} href={g.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-dark)' }}>
                      {g.title} →
                    </a>
                  ))}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {tools.downloadables.length === 0 ? (
                <p style={{ fontSize: 13, color: '#8A9A96' }}>Aún no hay recursos subidos.</p>
              ) : (
                tools.downloadables.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 13, background: 'var(--bg)', border: '1px solid var(--border-soft)' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: '#fff', border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📄</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-dark)' }}>{item.title}</span>
                    <a href={item.url} target="_blank" rel="noreferrer" style={{ padding: '8px 13px', borderRadius: 10, background: '#fff', border: '1.5px solid var(--brand)', color: 'var(--brand-dark)', fontSize: 12.5, fontWeight: 700 }}>⬇ Descargar</a>
                  </div>
                ))
              )}
            </div>
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
      ) : loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-body)', padding: '48px 0' }}>Cargando…</p>
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-body)' }}>No pudimos cargar las herramientas. Revisa tu conexión.</p>
          <button
            onClick={reload}
            style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--brand-dark)', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      ) : null}
    </div>
  );
}

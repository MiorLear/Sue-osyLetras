import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { DownloadableMediaItem, MediaList } from '@/components/DownloadableMediaItem';
import { Masthead } from '@/components/Masthead';
import { ScreenIntroHero } from '@/components/ScreenIntroHero';
import { VideoPlaceholder } from '@/components/VideoPlaceholder';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

/** Lo que la pantalla decia antes de que el texto fuera editable desde el CMS. */
const FALLBACK_INTRO = [
  'Encuentra materiales prácticos para implementar la metodología ExplorArte y fortalecer el bienestar emocional en tu comunidad educativa.',
];

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

  return (
    <div className="page">
      <Masthead
        eyebrow="Caja de herramientas"
        title="Materiales para"
        accent="la práctica"
        lede="Manuales, guías descargables y bibliografía para implementar la metodología ExplorArte."
      />

      <CacheAgeNote status={status} ageMs={ageMs} />

      <ScreenIntroHero variant="card" paragraphs={intro?.paragraphs} fallback={FALLBACK_INTRO} marginBottom={16} />

      <div style={{ marginBottom: 16 }}>
        <VideoPlaceholder caption="Cómo utilizar los recursos disponibles" video={intro?.video ?? null} duration="44 s" fallbackUrl="/videos/herramientas.mp4" />
      </div>

      {tools ? (
        <>
          {/* feature cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
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

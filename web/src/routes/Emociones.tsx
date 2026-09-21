import { useNavigate } from 'react-router-dom';
import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { Masthead } from '@/components/Masthead';
import { ScreenIntroHero } from '@/components/ScreenIntroHero';
import { VideoPlaceholder } from '@/components/VideoPlaceholder';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

/** Lo que la pantalla decia antes de que el texto fuera editable desde el CMS. */
const FALLBACK_INTRO = [
  'Las emociones forman parte de nuestra vida cotidiana. Reconocerlas, nombrarlas y comprenderlas es el primer paso para desarrollar bienestar emocional y construir relaciones saludables.',
  'Esta sección reúne recursos para comprender distintas emociones y acompañar conversaciones significativas dentro del aula.',
  'Explora actividades, lecturas y recursos diseñados para acompañar a tus estudiantes en el reconocimiento y gestión de sus emociones.',
];

export default function Emociones() {
  const navigate = useNavigate();
  const {
    data: emotions,
    status,
    ageMs,
    reload,
  } = useOfflineAsync(cacheKeys.emotionsList(), () => api.emotions.list(), []);
  // Se guarda el ScreenIntroVideo entero, no solo la URL: la sincronización de
  // medios necesita el MediaItem para saber qué descargar.
  const { data: intro } = useOfflineAsync(
    cacheKeys.screenIntro('emotions'),
    () => api.screenIntros.get('emotions'),
    [],
  );

  return (
    <div className="page">
      <Masthead
        eyebrow="Biblioteca de emociones"
        title="Reconocer para"
        accent="acompañar"
        lede="Recursos para comprender distintas emociones y guiar conversaciones significativas con tus estudiantes."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'stretch', marginBottom: 34 }}>
        <ScreenIntroHero variant="card" paragraphs={intro?.paragraphs} fallback={FALLBACK_INTRO}>
          {emotions && emotions.length > 0 ? (
            <div style={{ display: 'flex', gap: 18, marginTop: 22, paddingTop: 20, borderTop: '1px solid #F0E7D8' }}>
              <Stat n={emotions.length} label="emociones" color="var(--brand)" />
            </div>
          ) : null}
        </ScreenIntroHero>

        <VideoPlaceholder caption="¿Por qué es importante reconocer y comprender las emociones?" video={intro?.video ?? null} duration="36 s" fallbackUrl="/videos/biblioteca.mp4" />
      </div>

      <div className="section-head" style={{ gap: 12 }}>
        <h2 className="section-title">Biblioteca</h2>
        <span className="section-rule" />
      </div>

      <CacheAgeNote status={status} ageMs={ageMs} />

      {emotions && emotions.length > 0 ? (
        <div className="emotion-grid">
          {emotions.map((e) => (
            <button
              key={e.id}
              className="pressable"
              onClick={() => navigate(`/emociones/${e.id}`)}
              style={{ borderRadius: 20, padding: '26px 14px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: e.bg, border: `1px solid ${e.color}33` }}>
              <span style={{ fontSize: 50, lineHeight: 1 }}>{e.emoji}</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--text-dark)' }}>{e.name}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: e.color }}>Explorar →</span>
            </button>
          ))}
        </div>
      ) : (
        <ContentState
          status={status}
          onRetry={reload}
          what="las emociones"
          isEmpty={emotions?.length === 0}
          emptyLabel="Aún no hay emociones disponibles."
        />
      )}
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color }}>{n}</span>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</span>
    </span>
  );
}

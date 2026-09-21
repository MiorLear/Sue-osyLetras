import { Link } from 'react-router-dom';
import type { Topic } from '@explorarte/shared';
import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { ScreenIntroHero } from '@/components/ScreenIntroHero';
import { VideoPlaceholder } from '@/components/VideoPlaceholder';

import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { completedCount, effectiveProgress } from '@/lib/learning-progress';
import { useOfflineAsync } from '@/lib/useOfflineAsync';
import { usePendingIndex } from '@/lib/use-outbox';

const TOPIC_BG = ['#EEEAF7', '#EAF3E8', '#F8E8DE', '#FBF1DA'];

/**
 * Lo que la pantalla decía antes de que el texto fuera editable.
 *
 * En producción la tabla de introducciones está vacía, así que sin esto el día
 * del despliegue la tarjeta se quedaría en blanco. Se borra el día que el
 * contenido lleve un tiempo cargado desde el CMS.
 */
const FALLBACK_INTRO = [
  'Esta sección busca fortalecer los conocimientos y herramientas de las docentes para acompañar procesos de bienestar emocional en sus comunidades educativas.',
];

/** El pie de cada tarjeta, que depende de cómo se recorra el tema. */
function TopicFooter({ topic, done }: { topic: Topic; done: number }) {
  const total = topic.subtopics.length;

  if (topic.layout === 'path') {
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ height: 6, borderRadius: 6, background: 'var(--nav-bg)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand)', transition: 'width .3s' }} />
        </div>
        <span style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--brand-dark)' }}>
          {done === 0
            ? `Empezar · ${total} fase${total === 1 ? '' : 's'}`
            : done >= total
              ? `Recorrido completo · ${total} de ${total}`
              : `Continuar · fase ${done + 1} de ${total}`}
        </span>
      </div>
    );
  }

  const label =
    topic.layout === 'slides'
      ? `Explorar · ${total} tarjeta${total === 1 ? '' : 's'}`
      : `Ver ${total === 1 ? 'el subtema' : `los ${total} subtemas`}`;
  return (
    <span style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, fontWeight: 700, color: 'var(--brand-dark)' }}>
      {label}
    </span>
  );
}

export default function Aprendiendo() {
  const {
    data: topics,
    status,
    ageMs,
    reload,
  } = useOfflineAsync(cacheKeys.learningTopics(), () => api.learning.topics(), []);
  const { data: intro } = useOfflineAsync(
    cacheKeys.screenIntro('learning'),
    () => api.screenIntros.get('learning'),
    [],
  );
  // El avance es de la usuaria, y aquí solo alimenta la barra de las tarjetas:
  // si falla, la pantalla se dibuja igual con todo a cero.
  const { data: progress } = useOfflineAsync(
    cacheKeys.learningProgress(),
    () => api.learning.progress(),
    [],
  );
  const pending = usePendingIndex();
  const done = effectiveProgress(progress, pending.learningSteps);

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Aprendiendo"
        title="Bienestar"
        accent="emocional"
        lede="Conceptos y estrategias para fortalecer el acompañamiento socioemocional en tu comunidad educativa."
      />

      <ScreenIntroHero
        paragraphs={intro?.paragraphs}
        fallback={FALLBACK_INTRO}
        glyph="🌱"
        gradient="linear-gradient(150deg,#E7F4F2,#FFFCF6)"
        borderColor="#DCEDEA"
        marginBottom={30}
      />

      <div style={{ marginBottom: 30 }}>
        <VideoPlaceholder caption="La importancia de la formación continua en temas socioemocionales" video={intro?.video ?? null} duration="45 s" fallbackUrl="/videos/bienestar.mp4" />
      </div>

      <CacheAgeNote status={status} ageMs={ageMs} />

      {!topics || topics.length === 0 ? (
        <ContentState
          status={status}
          onRetry={reload}
          what="los contenidos"
          isEmpty={topics?.length === 0}
          emptyLabel="Aún no hay contenidos disponibles."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {topics.map((topic, ti) => (
            <Link
              key={topic.id}
              to={`/aprendiendo/${encodeURIComponent(topic.id)}`}
              style={{
                display: 'block',
                borderRadius: 18,
                padding: 18,
                background: '#fff',
                border: '1px solid var(--border)',
                color: 'inherit',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: 13, background: TOPIC_BG[ti % TOPIC_BG.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {topic.emoji}
                </span>
                <h3 style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-serif)', fontSize: 21, fontWeight: 600, color: 'var(--text-dark)' }}>
                  {topic.title}
                </h3>
                <Icon name="chevron-right" size={18} color="var(--gold-label)" />
              </div>

              {/* Los títulos de los subtemas, no interactivos: mantienen el
                  olfato que antes daba abrir el acordeón de un vistazo. */}
              {topic.subtopics.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                  {topic.subtopics.map((sub) => (
                    <span
                      key={sub.key}
                      style={{ padding: '5px 10px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-body)' }}>
                      {sub.emoji ? `${sub.emoji} ` : ''}
                      {sub.title}
                    </span>
                  ))}
                </div>
              ) : null}

              <TopicFooter topic={topic} done={completedCount(topic.subtopics, topic.id, done)} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

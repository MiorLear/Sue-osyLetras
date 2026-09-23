import { useNavigate, useParams } from 'react-router-dom';
import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { Icon } from '@/components/Icon';
import { BlockList } from '@/components/learning/BlockList';
import { TopicAccordion } from '@/components/learning/TopicAccordion';
import { TopicPath } from '@/components/learning/TopicPath';
import { TopicSlides } from '@/components/learning/TopicSlides';
import { toast } from '@/components/toast-store';

import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { currentStepIndex, effectiveProgress, progressId } from '@/lib/learning-progress';
import { isDeadSession } from '@/lib/offline-errors';
import { enqueueLearningStepComplete, enqueueLearningStepUncomplete } from '@/lib/outbox';
import { useNetworkStatus } from '@/lib/useNetworkStatus';
import { useOfflineAsync } from '@/lib/useOfflineAsync';
import { usePendingIndex } from '@/lib/use-outbox';

/**
 * Un tema de Aprendiendo, recorrido como diga su `layout`.
 *
 * Tiene ruta propia y no se despliega dentro del índice porque un mapa y un
 * mazo de tarjetas son experiencias que ocupan la pantalla: sin URL, el botón
 * atrás de Android saca de la sección entera en vez de cerrar el tema.
 * `/emociones/:id` ya sienta ese precedente.
 *
 * Lee la MISMA entrada de caché que el índice y busca por id. No hay una clave
 * por tema a propósito: duplicaría los MediaItem en la caché y la pasada de
 * sincronización los recorrería dos veces.
 */
export default function AprendiendoTema() {
  const { topicId = '' } = useParams();
  const navigate = useNavigate();
  const { online } = useNetworkStatus();

  const {
    data: topics,
    status,
    ageMs,
    reload,
  } = useOfflineAsync(cacheKeys.learningTopics(), () => api.learning.topics(), []);
  const { data: progress, reload: reloadProgress } = useOfflineAsync(
    cacheKeys.learningProgress(),
    () => api.learning.progress(),
    [],
  );
  const pending = usePendingIndex();

  const topic = topics?.find((t) => t.id === topicId);
  const done = effectiveProgress(progress, pending.learningSteps);

  const toggleStep = async (stepKey: string) => {
    if (!topic) return;
    const yaHecha = done.has(progressId(topic.id, stepKey));
    const encolar = () =>
      yaHecha
        ? enqueueLearningStepUncomplete(topic.id, stepKey)
        : enqueueLearningStepComplete(topic.id, stepKey);

    try {
      if (!online) {
        await encolar();
        toast.info('Guardamos tu avance. Se enviará cuando haya conexión.');
        return;
      }
      if (yaHecha) await api.learning.uncompleteStep(topic.id, stepKey);
      else await api.learning.completeStep(topic.id, stepKey);
      reloadProgress();
    } catch (e) {
      // Un 403 no se encola: la sesión ya se está purgando y la fila solo
      // llegaría a la lista de cambios fallidos.
      if (isDeadSession(e)) return;
      try {
        await encolar();
        toast.info('Guardamos tu avance. Se enviará cuando haya conexión.');
      } catch {
        toast.error('No se pudo guardar tu avance. Inténtalo de nuevo.');
      }
    }
  };

  const pendingKeys = new Set(
    [...pending.learningSteps.keys()].filter((id) => id.startsWith(`${topicId}::`)),
  );

  return (
    // El mapa necesita más ancho que la lectura suelta: en escritorio, con
    // 820px, el panel de la fase se quedaba en una columna de 360.
    <div className={topic?.layout === 'path' ? 'page page-narrow page-learning-path' : 'page page-narrow'}>
      <header className="gradient-header" style={{ background: 'var(--brand-gradient)' }}>
        <button
          className="tap-44"
          onClick={() => navigate('/aprendiendo')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.9)" /> Volver
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span aria-hidden style={{ fontSize: 40 }}>
            {topic?.emoji ?? '🌱'}
          </span>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Aprendiendo
            </div>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>
              {topic?.title ?? 'Tema'}
            </h1>
          </div>
        </div>
      </header>

      <CacheAgeNote status={status} ageMs={ageMs} />

      {!topic ? (
        <ContentState
          status={status}
          onRetry={reload}
          what="este tema"
          isEmpty={Boolean(topics)}
          emptyLabel="No encontramos este tema. Puede que lo hayan quitado."
        />
      ) : (
        <>
          {topic.intro.length > 0 ? (
            <div style={{ marginBottom: 26 }}>
              <BlockList blocks={topic.intro} />
            </div>
          ) : null}

          {/* `default` al acordeón para cualquier layout que esta versión no
              conozca: el CMS puede ir por delante de la app instalada, y una
              pantalla en blanco sería mucho peor que una forma de más. */}
          {topic.layout === 'path' ? (
            <TopicPath
              topic={topic}
              done={done}
              current={currentStepIndex(topic.subtopics, topic.id, done)}
              pendingKeys={pendingKeys}
              onToggle={toggleStep}
            />
          ) : topic.layout === 'slides' ? (
            <TopicSlides topic={topic} />
          ) : (
            <TopicAccordion topic={topic} />
          )}
        </>
      )}
    </div>
  );
}

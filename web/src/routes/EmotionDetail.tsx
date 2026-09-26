import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { EmotionActivity } from '@explorarte/shared';
import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { MediaList } from '@/components/DownloadableMediaItem';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { activityId, toggleSavedActivity, useIsActivitySaved } from '@/lib/saved-activities';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

function Divider() {
  return <div style={{ height: 1, background: 'var(--border-soft)', margin: '18px 0' }} />;
}
function SectionTitle({ children }: { children: string }) {
  return <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-dark)' }}>{children}</h3>;
}

/**
 * Una actividad, como tarjeta.
 *
 * Resumen: nombre, propósito, duración y edades. Al abrirla: objetivo,
 * materiales, paso a paso y preguntas para conversar. Es lo que pide el
 * documento de estructura, y cada cosa sale de su campo — nada se rellena
 * con valores por defecto, porque una docente planifica con la duración y la
 * edad que lee. Lo que el material no diga, no se dibuja.
 */
function ActivityCard({
  activity,
  color,
  bg,
  emotionId,
  emotionName,
  emoji,
}: {
  activity: EmotionActivity;
  color: string;
  bg: string;
  emotionId: string;
  emotionName: string;
  emoji: string;
}) {
  const [open, setOpen] = useState(false);
  const { title, purpose, duration, ages, materials, steps, questions } = activity;

  const chips = [duration ? `⏱ ${duration}` : null, ages ? `👧 ${ages}` : null].filter(
    (chip): chip is string => chip !== null,
  );
  // Sin nada que desplegar, el botón sobra: abriría un panel vacío.
  const hasDetail = Boolean(materials || steps.length || questions.length || purpose);

  const id = activityId(emotionId, title);
  const saved = useIsActivitySaved(id);

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', border: `1.5px solid ${open ? color : 'var(--border)'}` }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, flexShrink: 0 }}>
            <Icon name="edit" size={15} color={color} />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text-dark)' }}>{title}</span>
            {purpose ? <span className="clamp-2" style={{ display: 'block', marginTop: 4, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-body)' }}>{purpose}</span> : null}
          </span>
        </div>

        {chips.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            {chips.map((label) => (
              <span key={label} style={{ padding: '5px 9px', borderRadius: 20, background: bg, fontSize: 10.5, fontWeight: 600, color: 'var(--text-body)' }}>{label}</span>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
          {hasDetail ? (
            <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} style={{ flex: 1, minHeight: 44, borderRadius: 10, background: color, color: '#fff', fontSize: 12.5, fontWeight: 800 }}>
              {open ? 'Ocultar actividad' : 'Ver actividad'}
            </button>
          ) : (
            <span style={{ flex: 1, alignSelf: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Sin detalle todavía</span>
          )}
          <button
            type="button"
            aria-pressed={saved}
            onClick={() => toggleSavedActivity({ id, title, purpose, emotionId, emotionName, emoji })}
            style={{ minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${saved ? 'var(--danger)' : 'var(--border)'}`, color: saved ? 'var(--danger)' : 'var(--text-body)', fontSize: 12.5, fontWeight: 700 }}>
            {saved ? '♥ Guardada' : '♡ Guardar'}
          </button>
        </div>
      </div>

      {open && hasDetail ? (
        <div style={{ padding: 16, background: '#FAFDFD', borderTop: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {purpose ? <Detail label="Objetivo" value={purpose} /> : null}
          {duration || ages ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12 }}>
              {duration ? <Detail label="Duración" value={duration} /> : null}
              {ages ? <Detail label="Edades" value={ages} /> : null}
            </div>
          ) : null}
          {materials ? <Detail label="Materiales" value={materials} /> : null}

          {steps.length > 0 ? (
            <div>
              <DetailLabel>Paso a paso</DetailLabel>
              <ol style={{ marginTop: 6, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {steps.map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: 9 }}>
                    <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 10, display: 'grid', placeItems: 'center', background: bg, color, fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-body)' }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {questions.length > 0 ? (
            <div>
              <DetailLabel>Preguntas para conversar</DetailLabel>
              <ul style={{ marginTop: 6, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {questions.map((question) => (
                  <li key={question} style={{ display: 'flex', gap: 8 }}>
                    <span aria-hidden="true" style={{ color, fontWeight: 800 }}>•</span>
                    <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-body)' }}>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DetailLabel({ children }: { children: string }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dark)', textTransform: 'uppercase' }}>{children}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dark)', textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-body)' }}>{value}</div></div>;
}

export default function EmotionDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const {
    data: emotion,
    status,
    ageMs,
    reload,
  } = useOfflineAsync(cacheKeys.emotion(id!), () => api.emotions.get(id!), [id]);

  const color = emotion?.color ?? 'var(--brand)';
  const data = emotion?.content;

  return (
    <div className="page page-narrow">
      <header
        className="gradient-header"
        style={{ background: emotion ? `linear-gradient(135deg, ${emotion.color} 0%, ${emotion.color}CC 100%)` : 'var(--brand-gradient)' }}>
        {/* A la biblioteca, no a -1: con un enlace directo o tras recargar no
            hay historial dentro de la app y -1 sacaba de ella. */}
        <button className="tap-44" aria-label="Volver a Emociones" onClick={() => navigate('/emociones')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 600 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.9)" /> Emociones
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 44 }}>{emotion?.emoji ?? '✨'}</span>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Emoción</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{emotion?.name ?? 'Emoción'}</div>
          </div>
        </div>
      </header>

      <div>
        <CacheAgeNote status={status} ageMs={ageMs} />
        {data ? (
          <>
            <SectionTitle>¿Qué es esta emoción?</SectionTitle>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{data.description}</p>

            <Divider />
            <SectionTitle>¿Cómo puede verse en el aula?</SectionTitle>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{data.classroom}</p>

            <Divider />
            <SectionTitle>Preguntas para conversar</SectionTitle>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.questions.map((qn) => (
                <div key={qn} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color, fontSize: 13, fontWeight: 800 }}>•</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.45 }}>{qn}</span>
                </div>
              ))}
            </div>

            <Divider />
            <SectionTitle>Actividades para explorar esta emoción</SectionTitle>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.activities.map((a, i) => (
                <ActivityCard
                  key={i}
                  activity={a}
                  color={color}
                  bg={emotion?.bg ?? 'var(--nav-bg)'}
                  emotionId={emotion?.id ?? id ?? ''}
                  emotionName={emotion?.name ?? ''}
                  emoji={emotion?.emoji ?? '✨'}
                />
              ))}
            </div>

            <Divider />
            <SectionTitle>Historias sugeridas</SectionTitle>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.stories.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Aún no hay historias subidas para esta emoción.</p>
              ) : (
                <MediaList items={data.stories} />
              )}
            </div>
          </>
        ) : (
          <ContentState
            status={status}
            onRetry={reload}
            what="esta emoción"
            emptyLabel="No encontramos información para esta emoción."
          />
        )}
      </div>
    </div>
  );
}

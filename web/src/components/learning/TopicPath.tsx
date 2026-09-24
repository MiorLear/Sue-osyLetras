import { useEffect, useRef, useState } from 'react';
import type { Topic } from '@explorarte/shared';
import { MediaList } from '@/components/DownloadableMediaItem';
import { Icon } from '@/components/Icon';
import { PendingBadge } from '@/components/PendingBadge';
import { BlockList } from '@/components/learning/BlockList';
import { pathGeometry } from '@/components/learning/path-geometry';
import { progressId, stepState } from '@/lib/learning-progress';

// El tema como mapa de fases.
//
// El SVG dibuja SOLO el camino; los nodos son <button> de HTML colocados
// encima. Así los círculos no se deforman con el estirado horizontal del SVG,
// son enfocables, tienen nombre accesible y un área táctil de verdad — que es
// justo lo que una prueba de extremo a extremo comprueba en cada control.

interface TopicPathProps {
  topic: Topic;
  /** Las fases completadas, ya con lo pendiente superpuesto. */
  done: ReadonlySet<string>;
  /** La primera sin completar. */
  current: number;
  /** Fases con un cambio todavía en la bandeja de salida. */
  pendingKeys: ReadonlySet<string>;
  onToggle: (stepKey: string) => void;
}

// El mismo corte que `.learning-path` en global.css: a partir de aquí el mapa y
// el panel van lado a lado.
const DOS_COLUMNAS = '(min-width: 761px)';

// Cada nodo es una fila —círculo + tarjeta con descripción y botón— que se
// alterna a un lado y otro del camino. Los círculos van casi pegados al borde
// (13% / 87%) para que la tarjeta tenga el resto del ancho: con 280px de mapa
// le quedan ~200px, que son tres líneas de descripción legibles.
//
// La fila se centra en su punto con translateY(-50%), así que su alto no hace
// falta medirlo; lo que hay que garantizar es que dos filas seguidas no se
// pisen. La tarjeta tiene el título a 2 líneas y la descripción a 3, lo que la
// deja en ~185px como mucho: de ahí el paso de 212 y el margen de arriba.
const MAP = { stride: 212, amp: 37, padTop: 100, labelHeight: 58 } as const;

/** Qué dice el botón de la tarjeta, según cómo va esa fase. */
const CTA = { completed: 'Repasar', current: 'Empezar', locked: 'Ver fase' } as const;

export function TopicPath({ topic, done, current, pendingKeys, onToggle }: TopicPathProps) {
  const steps = topic.subtopics;
  // En dos columnas se abre la fase en curso de entrada: si no, media pantalla
  // es una caja vacía. En una columna, no: el panel quedaría debajo del mapa y
  // nadie lo pidió. Sin matchMedia (jsdom) cuenta como una columna.
  const [openIndex, setOpenIndex] = useState<number | null>(() =>
    steps.length > 0 && window.matchMedia?.(DOS_COLUMNAS).matches ? Math.min(current, steps.length - 1) : null,
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const shouldScroll = useRef(false);

  // En una columna el panel queda debajo del mapa, así que al tocar un nodo hay
  // que llevar a la docente hasta él. En dos columnas el panel ya está a la
  // vista y el scroll no molesta porque el elemento ya está arriba.
  useEffect(() => {
    if (openIndex === null || !shouldScroll.current) return;
    shouldScroll.current = false;
    // Llevar la vista al panel es una comodidad, no parte de la función: si el
    // entorno no la tiene (jsdom, un navegador viejo), la fase se abre igual.
    panelRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [openIndex]);

  if (steps.length === 0) return null;

  const completed = steps.filter((s) => done.has(progressId(topic.id, s.key))).length;
  const geo = pathGeometry(steps.length, MAP);
  const openStep = (i: number) => {
    shouldScroll.current = true;
    setOpenIndex(i);
  };
  const open = openIndex === null ? null : steps[openIndex];
  const openDone = open ? done.has(progressId(topic.id, open.key)) : false;
  const openPending = open ? pendingKeys.has(progressId(topic.id, open.key)) : false;
  const openState = openIndex === null ? null : stepState(openIndex, current, openDone);
  const nextStep = openIndex === null ? undefined : steps[openIndex + 1];

  return (
    <div className="learning-path">
      <div className="learning-path__aside">
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
              {completed} de {steps.length} fase{steps.length === 1 ? '' : 's'}
            </span>
            {completed >= steps.length ? (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-dark)' }}>Recorrido completo</span>
            ) : null}
          </div>
          <div style={{ height: 6, borderRadius: 6, background: 'var(--nav-bg)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(completed / steps.length) * 100}%`,
                height: '100%',
                background: 'var(--brand)',
                transition: 'width .35s',
              }}
            />
          </div>
        </div>

        <div className="learning-path__map" style={{ position: 'relative', height: geo.height }}>
          <svg
            aria-hidden
            viewBox={`0 0 100 ${geo.height}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: geo.height }}>
            <path d={geo.d} fill="none" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" stroke="var(--border)" />
            {/* El recorrido, encima y tramo a tramo: el que sale de una fase
                hecha se pinta. Un avance salteado se ve tal cual es, y sin
                guiones no hay nada que el trazo sin escalar pueda descuadrar. */}
            {geo.segments.map((seg, i) => (
              <path
                key={i}
                d={seg}
                fill="none"
                strokeWidth={4}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                stroke="var(--brand)"
                opacity={done.has(progressId(topic.id, steps[i].key)) ? 1 : 0}
                style={{ transition: 'opacity .35s ease' }}
              />
            ))}
          </svg>

          {steps.map((step, i) => {
            const isDone = done.has(progressId(topic.id, step.key));
            const state = stepState(i, current, isDone);
            const point = geo.points[i];
            const estado =
              state === 'completed' ? 'Completada' : state === 'current' ? 'En curso' : 'Aún no empezada';
            const description = step.description?.trim();
            const descId = `fase-${topic.id}-${step.key || i}-desc`;
            // Los pares a la izquierda (el círculo primero), los impares a la
            // derecha (la tarjeta primero): el camino queda siempre por fuera.
            const izquierda = point.x < 50;
            const lado = izquierda
              ? { left: `calc(${point.x}% - var(--path-node) / 2)`, right: 0 }
              : { left: 0, right: `calc(${100 - point.x}% - var(--path-node) / 2)` };
            const clases = ['learning-path__node'];
            if (i === openIndex) clases.push('learning-path__node--open');
            if (!izquierda) clases.push('learning-path__node--right');
            return (
              <button
                key={step.key}
                onClick={() => openStep(i)}
                aria-label={`Fase ${i + 1}: ${step.title}. ${estado}`}
                aria-describedby={description ? descId : undefined}
                aria-current={state === 'current' ? 'step' : undefined}
                className={clases.join(' ')}
                style={{ position: 'absolute', top: point.y, ...lado }}>
                <span
                  className={state === 'completed' ? 'learning-path__dot learning-path__dot--done' : 'learning-path__dot'}
                  style={{
                    width: 'var(--path-node)',
                    height: 'var(--path-node)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    ...(state === 'completed'
                      ? {
                          // --brand-dark y no --brand: tokens.css ya documenta
                          // que #2fa7a0 da 2,9:1 contra blanco, y el ✓ es un
                          // elemento no textual que necesita 3:1.
                          background: 'var(--brand-dark)',
                          border: '3px solid #fff',
                          boxShadow: '0 10px 22px -12px rgba(30,126,120,.55)',
                        }
                      : state === 'current'
                        ? {
                            background: '#fff',
                            border: '3px solid var(--brand)',
                            boxShadow: '0 0 0 6px rgba(47,167,160,.16)',
                          }
                        : {
                            background: 'var(--card-warm)',
                            border: '2px dashed var(--border-warm)',
                          }),
                  }}>
                  {state === 'completed' ? (
                    <Icon name="check" size={26} color="#fff" />
                  ) : (
                    <span aria-hidden style={{ fontSize: 30, opacity: state === 'locked' ? 0.35 : 1 }}>
                      {step.emoji || i + 1}
                    </span>
                  )}
                </span>

                <span className="learning-path__nodecard">
                  <span className="learning-path__eyebrow">
                    Fase {i + 1}
                    {state === 'completed' ? ' · Completada' : state === 'current' ? ' · En curso' : ''}
                  </span>
                  <span
                    className="learning-path__nodetitle"
                    style={{ color: state === 'locked' ? 'var(--text-muted)' : 'var(--text-dark)' }}>
                    {step.title}
                  </span>
                  {description ? (
                    <span id={descId} className="learning-path__nodedesc">
                      {description}
                    </span>
                  ) : null}
                  {/* Parece un botón porque el nodo entero lo es: un <button>
                      dentro de otro no es HTML válido, y dos controles para lo
                      mismo serían dos paradas de tabulación. */}
                  <span
                    aria-hidden
                    className={
                      state === 'current' ? 'learning-path__cta learning-path__cta--primary' : 'learning-path__cta'
                    }>
                    {CTA[state]} →
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="learning-path__panel" ref={panelRef}>
        {open === null || openIndex === null ? (
          <div
            style={{
              borderRadius: 18,
              border: '1.5px dashed var(--border-input)',
              background: '#fff',
              padding: 'clamp(18px, 5vw, 26px)',
            }}>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-body)' }}>
              Toca una fase del mapa para leerla. Al terminarla, márcala y el camino avanza.
            </p>
          </div>
        ) : (
          <div className="learning-path__card" style={{ borderRadius: 18, border: '1px solid var(--border)', background: '#fff', padding: 'clamp(18px, 5vw, 26px)' }}>
            {/* Una fase "aún no empezada" se abre igual: esto es formación, no
                un juego con recompensas, y sin conexión el bloqueo además sería
                falso —el cambio que la desbloquearía está en la bandeja—. */}
            {openState === 'locked' ? (
              <p style={{ marginBottom: 14, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                Te recomendamos empezar por la fase anterior.
              </p>
            ) : null}

            <div className="learning-path__head" style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
              <span aria-hidden className="learning-path__emoji" style={{ fontSize: 26 }}>
                {open.emoji || openIndex + 1}
              </span>
              <div>
                <span style={{ display: 'block', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--gold-label)' }}>
                  Fase {openIndex + 1} de {steps.length}
                </span>
                <h3 className="learning-path__title" style={{ fontFamily: 'var(--font-serif)', fontSize: 21, fontWeight: 600, color: 'var(--text-dark)' }}>
                  {open.title}
                </h3>
              </div>
            </div>

            {open.description?.trim() ? (
              <p className="learning-path__lede">{open.description.trim()}</p>
            ) : null}

            <BlockList blocks={open.blocks} headingLevel={4} />

            {[...open.pdfs, ...open.videos, ...open.audios].length > 0 ? (
              <div style={{ marginTop: 18 }}>
                <MediaList items={[...open.pdfs, ...open.videos, ...open.audios]} />
              </div>
            ) : null}

            <div className="learning-path__foot" style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              <button
                className="learning-path__toggle"
                aria-pressed={openDone}
                onClick={() => onToggle(open.key)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  padding: '0 22px',
                  borderRadius: 12,
                  fontSize: 13.5,
                  fontWeight: 700,
                  ...(openDone
                    ? { background: '#fff', border: '1.5px solid var(--brand)', color: 'var(--brand-dark)' }
                    : { background: 'var(--brand-dark)', color: '#fff', border: 'none' }),
                }}>
                {openDone ? '✓ Fase completada · Desmarcar' : 'Marcar esta fase como completada'}
              </button>
              {openPending ? <PendingBadge /> : null}
              {/* Con la fase ya marcada, lo siguiente es pasar a la otra: ese
                  paso se vuelve el botón principal, en vez de dejar a la
                  docente buscando el mapa. */}
              {openDone && nextStep ? (
                <button className="learning-path__next" onClick={() => openStep(openIndex + 1)}>
                  Siguiente fase: {nextStep.title} →
                </button>
              ) : null}
              {openIndex > 0 || (nextStep && !openDone) ? (
                <nav aria-label="Otras fases" className="learning-path__nav">
                  {openIndex > 0 ? (
                    <button className="learning-path__navbtn" onClick={() => openStep(openIndex - 1)}>
                      ← Fase anterior
                    </button>
                  ) : null}
                  {nextStep && !openDone ? (
                    <button
                      className="learning-path__navbtn learning-path__navbtn--next"
                      onClick={() => openStep(openIndex + 1)}>
                      Siguiente fase: {nextStep.title} →
                    </button>
                  ) : null}
                </nav>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

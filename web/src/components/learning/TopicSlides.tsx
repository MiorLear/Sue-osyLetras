import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { Topic } from '@explorarte/shared';
import { MediaList } from '@/components/DownloadableMediaItem';
import { Icon } from '@/components/Icon';
import { BlockList } from '@/components/learning/BlockList';
import { toSlides } from '@/components/learning/slides';

// El tema como mazo de tarjetas.
//
// Sin librería: una pista flex que se desplaza con `translateX`, y el gesto
// resuelto con Pointer Events. `touch-action: pan-y` en el visor es la línea
// que cede el gesto horizontal al componente y deja el vertical al navegador,
// que es lo que evita pelearse con el scroll de la página.

/** Distancia mínima para que un arrastre cuente como pasar de tarjeta. */
const SWIPE_MIN_PX = 56;
/** …o, si fue corto pero rápido, esta velocidad en px/ms. */
const SWIPE_MIN_VELOCITY = 0.4;
/** A partir de aquí los puntos dejan de ser usables y se cambian por "3 / 11". */
const MAX_DOTS = 8;

export function TopicSlides({ topic }: { topic: Topic }) {
  const slides = useMemo(() => toSlides(topic), [topic]);
  const [index, setIndex] = useState(0);
  const drag = useRef<{ x: number; y: number; t: number; horizontal: boolean } | null>(null);

  if (slides.length === 0) return null;

  const go = (next: number) => setIndex(Math.min(Math.max(next, 0), slides.length - 1));

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // No secuestrar la escritura si algún día una tarjeta lleva un campo.
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    // Arriba y abajo NO se tocan: son el scroll de la página, y robarlos es el
    // fallo de accesibilidad clásico de todo carrusel.
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(index + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(index - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(slides.length - 1);
    else return;
    e.preventDefault();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, horizontal: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.horizontal) return;
    const dx = Math.abs(e.clientX - d.x);
    const dy = Math.abs(e.clientY - d.y);
    // Solo se reclama el gesto cuando queda claro que es horizontal; si no,
    // era un scroll y hay que dejarlo pasar.
    if (dx > 12 && dx > dy) d.horizontal = true;
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.horizontal) return;
    const dx = e.clientX - d.x;
    const dt = Math.max(1, e.timeStamp - d.t);
    if (Math.abs(dx) > SWIPE_MIN_PX || Math.abs(dx) / dt > SWIPE_MIN_VELOCITY) {
      go(dx < 0 ? index + 1 : index - 1);
    }
  };

  const current = slides[index];

  return (
    <section
      aria-roledescription="carrusel"
      aria-label={`${topic.title}: ${slides.length} tarjeta${slides.length === 1 ? '' : 's'}`}
      tabIndex={-1}
      onKeyDown={onKeyDown}>
      {/* Barra de avance por el mazo. No es progreso guardado: solo dice por
          dónde va la lectura. */}
      <div style={{ height: 4, borderRadius: 4, background: 'var(--nav-bg)', overflow: 'hidden', marginBottom: 16 }}>
        <div
          style={{
            width: `${((index + 1) / slides.length) * 100}%`,
            height: '100%',
            background: 'var(--brand)',
            transition: 'width .3s',
          }}
        />
      </div>

      <div
        className="slides-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}>
        <div className="slides-track" style={{ transform: `translateX(${-index * 100}%)` }}>
          {slides.map((slide, i) => (
            <div
              key={slide.key}
              role="group"
              aria-roledescription="tarjeta"
              aria-label={`${i + 1} de ${slides.length}: ${slide.title}`}
              // `|| undefined` para que React lo omita en la tarjeta visible:
              // aria-hidden="false" es válido pero ensucia el DOM sin aportar.
              aria-hidden={i !== index || undefined}
              // `inert` saca del orden de tabulación los enlaces de las
              // tarjetas ocultas sin recurrir a display:none, que rompería la
              // transición. Es booleano nativo desde React 19.
              inert={i !== index}>
              {slide.eyebrow ? (
                <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--gold-label)', marginBottom: 6 }}>
                  {slide.eyebrow}
                </p>
              ) : null}
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 18 }}>
                {slide.title}
              </h3>
              <BlockList blocks={slide.blocks} headingLevel={4} />
              {slide.media.length > 0 ? (
                <div style={{ marginTop: 18 }}>
                  <MediaList items={slide.media} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Tarjeta {index + 1} de {slides.length}: {current.title}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
        <button
          className="tap-44"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Tarjeta anterior"
          style={{ borderRadius: 22, background: '#fff', border: '1.5px solid var(--border-input)', opacity: index === 0 ? 0.4 : 1 }}>
          <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
            <Icon name="chevron-right" size={18} color="var(--brand-dark)" />
          </span>
        </button>

        {slides.length <= MAX_DOTS ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                className="tap-44"
                onClick={() => go(i)}
                aria-label={`Tarjeta ${i + 1} de ${slides.length}`}
                aria-current={i === index || undefined}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none' }}>
                <span
                  style={{
                    width: i === index ? 22 : 9,
                    height: 9,
                    borderRadius: 5,
                    background: i === index ? 'var(--brand-dark)' : 'var(--border-input)',
                    transition: 'width .2s, background .2s',
                  }}
                />
              </button>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
            {index + 1} / {slides.length}
          </span>
        )}

        <button
          className="tap-44"
          onClick={() => go(index + 1)}
          disabled={index === slides.length - 1}
          aria-label="Tarjeta siguiente"
          style={{ borderRadius: 22, background: '#fff', border: '1.5px solid var(--border-input)', opacity: index === slides.length - 1 ? 0.4 : 1 }}>
          <Icon name="chevron-right" size={18} color="var(--brand-dark)" />
        </button>
      </div>
    </section>
  );
}

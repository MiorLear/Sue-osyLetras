import type { CSSProperties, ReactNode } from 'react';

// La tarjeta de introducción que abre una pantalla.
//
// Es, pixel a pixel, la que ya tenían: el degradado suave con el emoji gigante
// al 8% asomando por la esquina en Aprendiendo, la tarjeta blanca en Emociones
// y Herramientas. Lo único que cambia es de dónde sale el texto: donde había
// párrafos escritos a mano en el JSX ahora están los que la administradora
// escriba en el CMS.
//
// Cada pantalla pasa además su propio texto de respaldo, y no es un detalle: en
// producción la tabla de introducciones está vacía, así que sin él el día del
// despliegue las pantallas se quedarían mudas. Misma filosofía que
// `VideoPlaceholder` — el CMS manda, el literal es la copia de seguridad.

interface ScreenIntroHeroProps {
  /** Lo que venga del CMS. Si no hay nada, se usa `fallback`. */
  paragraphs?: string[] | null;
  /**
   * El texto que esta pantalla tenía escrito a mano. Vacío es legítimo: la
   * pantalla de inicio no tenía ninguno, así que ahí no se dibuja nada hasta
   * que alguien escriba el primero desde el CMS.
   */
  fallback: string[];
  /** `gradient` es la de Aprendiendo; `card` la tarjeta blanca de las otras. */
  variant?: 'gradient' | 'card';
  /** Solo en `gradient`: el emoji enorme del fondo. */
  glyph?: string;
  gradient?: string;
  borderColor?: string;
  marginBottom?: number;
  /** Lo que va debajo del texto dentro de la misma tarjeta (el contador de Emociones). */
  children?: ReactNode;
}

export function ScreenIntroHero({
  paragraphs,
  fallback,
  variant = 'gradient',
  glyph,
  gradient = 'linear-gradient(150deg,#E7F4F2,#FFFCF6)',
  borderColor = '#DCEDEA',
  marginBottom,
  children,
}: ScreenIntroHeroProps) {
  const fromCms = (paragraphs ?? []).map((p) => p.trim()).filter(Boolean);
  const visible = fromCms.length > 0 ? fromCms : fallback;
  if (visible.length === 0 && !children) return null;

  const isGradient = variant === 'gradient';
  const box: CSSProperties = isGradient
    ? {
        borderRadius: 24,
        padding: '30px 32px',
        background: gradient,
        border: `1px solid ${borderColor}`,
        position: 'relative',
        overflow: 'hidden',
      }
    : {
        borderRadius: 24,
        padding: 'clamp(20px, 6vw, 32px)',
        background: '#fff',
        border: '1px solid var(--border)',
      };

  return (
    <div style={{ ...box, marginBottom }}>
      {isGradient && glyph ? (
        <span aria-hidden style={{ position: 'absolute', top: -20, right: -10, fontSize: 120, opacity: 0.08 }}>
          {glyph}
        </span>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
        {visible.map((p, i) => (
          <p
            key={i}
            style={{
              fontSize: 15.5,
              lineHeight: 1.7,
              color: isGradient ? '#3F5450' : 'var(--text-body)',
              maxWidth: isGradient ? 560 : undefined,
            }}>
            {p}
          </p>
        ))}
      </div>
      {children}
    </div>
  );
}

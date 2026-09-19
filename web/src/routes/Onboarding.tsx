import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { VideoPlaceholder } from '@/components/VideoPlaceholder';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

const PILARES = [
  { emoji: '🧠', title: 'Salud mental', text: 'Recursos para comprender y promover el bienestar psicológico y emocional.' },
  { emoji: '💚', title: 'Desarrollo emocional', text: 'Herramientas para reconocer, comprender y expresar las emociones.' },
  { emoji: '🤝', title: 'Desarrollo social', text: 'Experiencias para fortalecer la empatía, la convivencia y las relaciones saludables.' },
];

const SLIDES = 2;

export default function Onboarding() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  // Esta pantalla es previa al login, así que su caché va al ámbito anónimo.
  // El hook además absorbe el fallo de red: antes era un .then() suelto que sin
  // conexión terminaba en un rechazo sin capturar.
  const { data: intro } = useOfflineAsync(
    cacheKeys.screenIntro('home'),
    () => api.screenIntros.get('home'),
    [],
  );
  const introVideo = intro?.video ?? null;
  const goToLogin = () => navigate('/login');
  const next = () => (index < SLIDES - 1 ? setIndex(index + 1) : goToLogin());

  return (
    <div className="auth-shell">
      <div className="auth-card wide">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="muted" style={{ fontSize: 13, fontWeight: 600 }} onClick={goToLogin}>
          Saltar
        </button>
      </div>

      <div style={{ minHeight: 'min(380px, 55dvh)' }}>
        {index === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 16 }}>
            <Logo size={64} />
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-dark)', textAlign: 'center' }}>
              Bienvenida a ExplorArte
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-body)', textAlign: 'center', lineHeight: 1.5 }}>
              Lectura, arte y emociones para acompañar el bienestar en el aula.
            </p>
            <VideoPlaceholder caption="Video de bienvenida del equipo de Sueños y Letras" video={introVideo} duration="1 min 34 s" fallbackUrl="/videos/inicio.mp4" />
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Un espacio creado para docentes, con recursos, historias y herramientas prácticas para
              acompañar el bienestar emocional, la creatividad y el desarrollo socioemocional de niñas,
              niños y adolescentes.
            </p>
          </div>
        ) : null}

        {index === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-dark)' }}>¿Qué encontrarás en ExplorArte?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>
              ExplorArte es una iniciativa de Sueños y Letras que reúne recursos para fortalecer el
              bienestar emocional y socioemocional en las comunidades educativas a través de la lectura,
              el arte y experiencias participativas.
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
              Nuestros recursos se construyen desde tres pilares:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {PILARES.map((p) => (
                <div key={p.title} className="card" style={{ padding: 16, display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{p.emoji}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{p.title}</div>
                    <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.45 }}>{p.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

      </div>

      <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {Array.from({ length: SLIDES }).map((_, i) => (
            <button
              key={i}
              type="button"
              className="tap-44"
              aria-label={`Ir a la pantalla ${i + 1} de ${SLIDES}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}>
              <span
                aria-hidden="true"
                style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 9, background: i === index ? 'var(--brand)' : 'var(--border-input)', transition: 'width .2s' }}
              />
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={next} style={{ padding: 15, borderRadius: 14 }}>
          {index === SLIDES - 1 ? 'Comenzar' : 'Siguiente'}
        </button>
        <button className="muted center" style={{ fontSize: 13 }} onClick={goToLogin}>
          Ya tengo cuenta — <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Iniciar sesión</span>
        </button>
      </div>
      </div>
    </div>
  );
}

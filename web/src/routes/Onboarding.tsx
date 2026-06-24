import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { VideoPlaceholder } from '@/components/VideoPlaceholder';

const PILARES = [
  { emoji: '🧠', title: 'Salud mental', text: 'Promovemos herramientas que fortalecen el bienestar psicológico y emocional.' },
  { emoji: '💚', title: 'Desarrollo emocional', text: 'Facilitamos espacios para reconocer, comprender y expresar emociones de manera saludable.' },
  { emoji: '🤝', title: 'Desarrollo social', text: 'Fortalecemos habilidades que favorecen relaciones positivas y comunidades más empáticas.' },
];

const PASOS = [
  { n: '1', title: 'Reconocer', text: 'Comprender emociones, pensamientos y comportamientos.' },
  { n: '2', title: 'Expresar', text: 'Utilizar la lectura, el arte y el diálogo para expresar experiencias y emociones.' },
  { n: '3', title: 'Conectar', text: 'Fortalecer la empatía, la convivencia y las relaciones saludables.' },
  { n: '4', title: 'Crecer', text: 'Desarrollar herramientas para el bienestar personal y comunitario.' },
];

const SLIDES = 3;

export default function Onboarding() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
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

      <div style={{ minHeight: 380 }}>
        {index === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 16 }}>
            <Logo size={64} />
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-dark)', textAlign: 'center' }}>
              Bienvenida a ExplorArte
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-body)', textAlign: 'center', lineHeight: 1.5 }}>
              Lectura, arte y emociones para construir comunidades de aprendizaje más saludables.
            </p>
            <VideoPlaceholder caption="Video de bienvenida del equipo de Sueños y Letras" />
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Acompañamos a docentes con recursos prácticos para promover el bienestar emocional, la
              creatividad y el desarrollo socioemocional de niñas, niños y adolescentes.
            </p>
          </div>
        ) : null}

        {index === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-dark)' }}>¿Qué es ExplorArte?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55 }}>
              ExplorArte es una metodología creada por Sueños y Letras para fortalecer la salud mental y
              el bienestar emocional en comunidades educativas a través de la lectura, el arte y
              experiencias participativas.
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
              Trabajamos desde tres pilares fundamentales:
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

        {index === 2 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-dark)' }}>¿Cómo funciona?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {PASOS.map((p) => (
                <div key={p.n} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--nav-bg)', border: '1.5px solid rgba(61,191,184,0.3)', flexShrink: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>{p.n}</span>
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dark)' }}>{p.title}</div>
                    <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.45 }}>{p.text}</div>
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
            <span key={i} style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 9, background: i === index ? 'var(--brand)' : 'var(--border-input)', transition: 'width .2s' }} />
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

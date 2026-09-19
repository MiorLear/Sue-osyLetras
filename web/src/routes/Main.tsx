import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Masthead } from '@/components/Masthead';
import { VideoPlaceholder } from '@/components/VideoPlaceholder';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { useSavedActivities } from '@/lib/saved-activities';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

interface HubCard { emoji: string; title: string; desc: string; cta: string; href: string; keywords: string; bg: string; accent: string }

const CARDS: HubCard[] = [
  { emoji: '📚', title: 'Biblioteca de emociones', desc: 'Actividades, lecturas y recursos para acompañar emociones específicas.', cta: 'Explorar emociones', href: '/emociones', keywords: 'alegría tristeza enojo miedo frustración vergüenza decepción ansiedad emociones actividades', bg: '#EBF8FF', accent: '#3182CE' },
  { emoji: '🧰', title: 'Caja de herramientas docente', desc: 'Materiales descargables y herramientas prácticas para llevar al aula.', cta: 'Ver herramientas', href: '/herramientas', keywords: 'manual guías plantillas fichas materiales descargables facilitación', bg: '#FFFAF0', accent: '#C66B25' },
  { emoji: '🌱', title: 'Aprendiendo sobre bienestar emocional', desc: 'Conceptos y estrategias para fortalecer el acompañamiento socioemocional.', cta: 'Explorar contenidos', href: '/aprendiendo', keywords: 'autocuidado salud mental infancia emociones difíciles estrategias aula', bg: '#F0FFF4', accent: '#2F855A' },
];

const greeting = (date: Date) => date.getHours() < 12 ? 'Buenos días,' : date.getHours() < 19 ? 'Buenas tardes,' : 'Buenas noches,';

export default function Main() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const saved = useSavedActivities();
  const { data: intro } = useOfflineAsync(cacheKeys.screenIntro('home'), () => api.screenIntros.get('home'), []);
  const visibleCards = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return term ? CARDS.filter((card) => `${card.title} ${card.desc} ${card.keywords}`.toLocaleLowerCase('es').includes(term)) : CARDS;
  }, [query]);

  return (
    <div className="page">
      <Masthead eyebrow="Panel principal" title={greeting(new Date())} accent={user?.name ?? 'María'} lede="Tu espacio para acompañar el bienestar emocional en el aula, todo en un solo lugar." />

      <section style={{ padding: 'clamp(20px, 5vw, 30px)', borderRadius: 24, background: 'linear-gradient(135deg,#FFF9E8,#FFFDF7)', border: '1px solid #F0DEC8', marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 25, fontWeight: 600, color: 'var(--text-dark)' }}>Bienvenida a ExplorArte 💛</div>
            <p style={{ marginTop: 9, fontSize: 14, lineHeight: 1.65, color: 'var(--text-body)' }}>Hemos preparado este espacio para acompañarte con ideas, historias y herramientas para el bienestar emocional en el aula. Antes de comenzar, queremos darte la bienvenida.</p>
          </div>
          <VideoPlaceholder caption="Ver video de bienvenida" video={intro?.video ?? null} duration="1 min 34 s" fallbackUrl="/videos/inicio.mp4" />
        </div>
      </section>

      <section style={{ marginBottom: 30 }}>
        <div className="section-head" style={{ display: 'block' }}><h2 className="section-title">¿Qué necesitas acompañar hoy?</h2><p style={{ marginTop: 5, fontSize: 13, color: 'var(--text-muted)' }}>Busca una emoción, una herramienta o una idea para llevar al aula.</p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 680, padding: '0 16px', borderRadius: 14, background: '#fff', border: `1.5px solid ${query ? 'var(--brand)' : 'var(--border)'}` }}>
          <span aria-hidden="true">⌕</span>
          <input aria-label="Buscar en ExplorArte" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en ExplorArte..." style={{ flex: 1, minWidth: 0, padding: '14px 0', border: 0, outline: 0, background: 'transparent', color: 'var(--text-dark)', font: 'inherit' }} />
          {query ? <button type="button" onClick={() => setQuery('')} aria-label="Borrar búsqueda" style={{ color: 'var(--text-muted)', fontSize: 18 }}>×</button> : null}
        </div>
      </section>

      <section style={{ marginBottom: 30 }}>
        <div className="section-head"><h2 className="section-title">Explora según tu necesidad</h2><span className="section-rule" /></div>
        <div className="hub-grid">
          {visibleCards.map((card) => (
            <button key={card.href} className="pressable" onClick={() => navigate(card.href)} style={{ textAlign: 'left', borderRadius: 20, padding: 22, background: '#fff', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 15 }}>
              <span style={{ width: 54, height: 54, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: card.bg }}>{card.emoji}</span>
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: 'var(--text-dark)' }}>{card.title}</span><span style={{ display: 'block', marginTop: 6, fontSize: 13, lineHeight: 1.5, color: '#6A7C78' }}>{card.desc}</span></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: card.accent }}>{card.cta} →</span>
            </button>
          ))}
        </div>
        {!visibleCards.length ? <div style={{ padding: 22, borderRadius: 16, background: '#fff', color: 'var(--text-muted)', textAlign: 'center' }}>No encontramos coincidencias. Prueba con “emociones”, “herramientas” o “bienestar”.</div> : null}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18, marginBottom: 22 }}>
        <button onClick={() => navigate('/emociones/ansiedad')} className="pressable" style={{ textAlign: 'left', padding: 20, borderRadius: 20, background: '#F0FFF4', border: '1px solid #BEE3C8', display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 38 }}>😰</span><span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#2F855A', textTransform: 'uppercase' }}>Te recomendamos explorar</span><span style={{ display: 'block', marginTop: 4, fontSize: 15, fontWeight: 800, color: 'var(--text-dark)' }}>Acompañar la ansiedad en el aula</span><span style={{ display: 'block', marginTop: 4, fontSize: 12.5, color: 'var(--text-body)' }}>Ideas breves para reconocer señales y recuperar la calma.</span></span><span>→</span>
        </button>
        <div style={{ padding: 20, borderRadius: 20, background: '#fff', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--nav-bg)', fontSize: 23 }}>🔖</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--brand-dark)', textTransform: 'uppercase' }}>Mis recursos</span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>
                {saved.length === 0
                  ? 'Guarda tus actividades favoritas'
                  : `${saved.length} ${saved.length === 1 ? 'actividad guardada' : 'actividades guardadas'}`}
              </span>
            </span>
          </div>

          {saved.length === 0 ? (
            <p style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-muted)' }}>
              En cada actividad de la Biblioteca de emociones encontrarás <strong>♡ Guardar</strong>. Lo que guardes aparecerá aquí para volver después.
            </p>
          ) : (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {saved.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  className="pressable"
                  onClick={() => navigate(`/emociones/${item.emotionId}`)}
                  style={{ textAlign: 'left', minHeight: 44, padding: '8px 10px', borderRadius: 12, background: 'var(--card-warm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 19 }} aria-hidden="true">{item.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>{item.title}</span>
                    {item.emotionName ? <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>{item.emotionName}</span> : null}
                  </span>
                  <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>›</span>
                </button>
              ))}
              {saved.length > 4 ? (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 4 }}>
                  y {saved.length - 4} más en la Biblioteca de emociones.
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: 20, borderRadius: 18, background: '#FFF8F5', borderLeft: '4px solid #F6AD55', marginBottom: 18 }}><div style={{ fontSize: 11, fontWeight: 800, color: '#B45309', textTransform: 'uppercase' }}>Para pensar hoy</div><p style={{ marginTop: 7, fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.5, color: 'var(--text-dark)' }}>Antes de corregir una conducta, pregúntate qué emoción podría estar intentando comunicar.</p></div>
      <button onClick={() => navigate('/comunidad')} className="pressable" style={{ width: '100%', textAlign: 'left', padding: 18, borderRadius: 18, background: '#F5F0FF', border: '1px solid #D9C8FA', display: 'flex', alignItems: 'center', gap: 13 }}><span style={{ fontSize: 30 }}>💬</span><span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--text-dark)' }}>Comunidad ExplorArte</span><span style={{ display: 'block', marginTop: 3, fontSize: 12.5, color: 'var(--text-body)' }}>Comparte experiencias e ideas con otras docentes.</span></span><span style={{ color: '#7C3AED' }}>→</span></button>
    </div>
  );
}

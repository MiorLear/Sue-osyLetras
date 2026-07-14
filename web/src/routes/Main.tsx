import { useNavigate } from 'react-router-dom';
import { EVENT_COLORS } from '@explorarte/shared';
import { Masthead } from '@/components/Masthead';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';

interface HubCard {
  emoji: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  bg: string;
  accent: string;
}

const CARDS: HubCard[] = [
  { emoji: '📚', title: 'Biblioteca de emociones', desc: 'Recursos para acompañar emociones específicas en el aula.', cta: 'Explorar', href: '/emociones', bg: '#FBF1DA', accent: '#C98A3E' },
  { emoji: '🧰', title: 'Caja de herramientas', desc: 'Manuales y materiales descargables para docentes.', cta: 'Ver herramientas', href: '/herramientas', bg: '#E7F4F2', accent: 'var(--brand-dark)' },
  { emoji: '🌱', title: 'Aprendiendo', desc: 'Conceptos y estrategias de acompañamiento socioemocional.', cta: 'Explorar', href: '/aprendiendo', bg: '#EAF3E8', accent: '#5C8A4F' },
  { emoji: '💬', title: 'Comunidad', desc: 'Comparte experiencias con otras docentes.', cta: 'Ver comunidad', href: '/comunidad', bg: '#F8E8DE', accent: 'var(--clay-dark)' },
];

const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtTime12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
};

const minutesUntil = (dateStr: string, hhmm: string) => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const target = new Date(y, mo - 1, d, h, mi).getTime();
  return Math.round((target - Date.now()) / 60000);
};

const fmtCountdown = (minutes: number) => {
  if (minutes <= 0) return 'Ahora';
  if (minutes < 60) return `En ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `En ${hours} h ${rest} min` : `En ${hours} h`;
};

const greeting = (d: Date) => {
  const h = d.getHours();
  if (h < 12) return 'Buenos días,';
  if (h < 19) return 'Buenas tardes,';
  return 'Buenas noches,';
};

interface RailEvent {
  key: string;
  group: string;
  time: string;
  label: string;
  color: string;
  urgent: boolean;
}

export default function Main() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: events } = useAsync(() => api.events.list(), []);

  const today = new Date();

  // Only the next few upcoming/ongoing events, mirroring the mobile home rail.
  const upcoming: RailEvent[] = (events ?? [])
    .map((e) => ({ e, minutes: minutesUntil(e.date, e.startTime) }))
    .filter(({ minutes }) => minutes > -60)
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, 3)
    .map(({ e, minutes }) => ({
      key: e.id,
      group: e.title,
      time: fmtTime12(e.startTime),
      label: fmtCountdown(minutes),
      color: EVENT_COLORS[e.type] ?? 'var(--brand)',
      urgent: minutes <= 30,
    }));

  const heroLede =
    upcoming.length > 0
      ? `Tienes ${upcoming.length} ${upcoming.length === 1 ? 'evento próximo' : 'eventos próximos'} en tu agenda y recursos por descubrir en tu caja de herramientas.`
      : 'No tienes eventos próximos. Explora los recursos de tu caja de herramientas.';

  return (
    <div className="page">
      <Masthead
        eyebrow="Panel principal"
        title={greeting(today)}
        accent={user?.name ?? 'María'}
        lede="Tu espacio para acompañar el bienestar emocional en el aula, todo en un solo lugar."
      />

      {/* hero */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr .95fr',
          borderRadius: 28,
          overflow: 'hidden',
          border: '1px solid #EAE0D0',
          background: '#fff',
          boxShadow: '0 18px 50px -28px rgba(24,48,45,.28)',
          marginBottom: 40,
        }}>
        <div
          style={{
            position: 'relative',
            padding: '44px 42px',
            background: 'radial-gradient(120% 120% at 0% 0%,#EAF5F3 0%,#FFFCF6 60%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
          <span style={{ position: 'absolute', top: -30, right: -20, fontSize: 130, opacity: 0.06, animation: 'floaty 7s ease-in-out infinite' }}>🌿</span>
          <div style={{ fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C5895F', fontWeight: 700, marginBottom: 8, position: 'relative' }}>Bienvenida de nuevo</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, lineHeight: 1.1, color: 'var(--text-dark)', position: 'relative' }}>
            Hoy es un buen día para <span style={{ fontStyle: 'italic', color: 'var(--brand)' }}>acompañar</span> emociones.
          </div>
          <p style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-body)', maxWidth: 380, position: 'relative' }}>
            {heroLede}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, position: 'relative' }}>
            <button onClick={() => navigate('/emociones')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 20px', borderRadius: 13, background: 'var(--brand-gradient)', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: '0 10px 22px -8px rgba(31,126,118,.6)' }}>
              Explorar emociones <span style={{ fontSize: 16 }}>→</span>
            </button>
            <button onClick={() => navigate('/herramientas')} style={{ padding: '13px 20px', borderRadius: 13, background: '#fff', border: '1.5px solid var(--border-input)', color: 'var(--brand-dark)', fontSize: 14, fontWeight: 700 }}>
              Mis recursos
            </button>
          </div>
        </div>
        <div
          style={{
            minHeight: 300,
            background: 'linear-gradient(160deg,#2FA7A0,#1E7E78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
          <span style={{ fontSize: 120, opacity: 0.9 }}>🌻</span>
          <span style={{ position: 'absolute', bottom: 18, left: 22, color: 'rgba(255,255,255,.85)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15 }}>
            Sueños y Letras
          </span>
        </div>
      </div>

      <div className="main-split">
        {/* hub cards */}
        <section>
          <div className="section-head">
            <h2 className="section-title">Explora según tu necesidad</h2>
          </div>
          <div className="hub-grid">
            {CARDS.map((c) => (
              <button
                key={c.href}
                className="pressable"
                onClick={() => navigate(c.href)}
                style={{ textAlign: 'left', borderRadius: 20, padding: 22, background: '#fff', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ width: 54, height: 54, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: c.bg }}>{c.emoji}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: 'var(--text-dark)' }}>{c.title}</span>
                  <span style={{ display: 'block', marginTop: 6, fontSize: 13, lineHeight: 1.5, color: '#6A7C78' }}>{c.desc}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: c.accent }}>
                  {c.cta} <span style={{ fontSize: 15 }}>→</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* calendar rail */}
        <section>
          <div className="section-head">
            <h2 className="section-title">Mi calendario</h2>
            <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>Hoy · {DOW_SHORT[today.getDay()]} {today.getDate()} {MONTHS_SHORT[today.getMonth()]}</span>
          </div>
          <div style={{ borderRadius: 20, background: '#fff', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {upcoming.length === 0 ? (
              <div style={{ padding: '22px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                No tienes eventos próximos.
              </div>
            ) : (
              upcoming.map((ev, i) => (
                <div key={ev.key} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: i < upcoming.length - 1 ? '1px solid #F3ECDD' : 'none' }}>
                  <span style={{ width: 3.5, height: 42, borderRadius: 9, background: ev.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{ev.group}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{ev.time}</span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20, color: ev.urgent ? 'var(--clay-dark)' : 'var(--text-muted)', background: ev.urgent ? '#F8E8DE' : '#F4EEE2' }}>{ev.label}</span>
                </div>
              ))
            )}
          </div>
          <button onClick={() => navigate('/calendar')} style={{ width: '100%', marginTop: 12, padding: 13, borderRadius: 14, background: '#F4EEE2', border: '1px solid var(--border-warm)', color: 'var(--brand-dark)', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            🗓️ Ver calendario completo
          </button>

          <div style={{ marginTop: 22, borderRadius: 20, padding: 22, background: 'linear-gradient(155deg,#FBF1DA,#F8E8DE)', border: '1px solid #F0DEC8', position: 'relative', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', bottom: -18, right: -6, fontSize: 84, opacity: 0.18 }}>🌻</span>
            <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C5895F', fontWeight: 700, position: 'relative' }}>Frase del día</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18, lineHeight: 1.4, color: '#7A5230', marginTop: 8, position: 'relative' }}>
              "Nombrar una emoción es el primer paso para acompañarla."
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

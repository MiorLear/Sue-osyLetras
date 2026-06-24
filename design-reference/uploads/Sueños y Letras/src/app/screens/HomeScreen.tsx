import { useNavigate } from "react-router";
import {
  User,
  HelpCircle,
  MessageCircle,
  Heart,
  Repeat2,
  Clock,
  BookOpen,
  ChevronRight,
  Calendar,
  Home,
} from "lucide-react";
import logoImg from "figma:asset/309521523_406445261650683_3586315977316360400_n.jpg";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { BottomNav } from "../components/BottomNav";

const BRAND = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const BRAND_LIGHT = "#E6F8F7";
const TEXT_DARK = "#1A3A38";
const TEXT_MED = "#4A6E6B";
const TEXT_MUTED = "#717182";

const modules = [
  { id: "felicidad", name: "Felicidad", emoji: "😊", bg: "#FFF8E1", border: "#F0B429", text: "#7A5800" },
  { id: "enojo",     name: "Enojo",     emoji: "😠", bg: "#FFF0F0", border: "#E53E3E", text: "#7D1A1A" },
  { id: "desagrado", name: "Desagrado", emoji: "🤢", bg: "#F0FFF4", border: "#38A169", text: "#1C5E2C" },
];

const foroPosts = [
  {
    id: 1,
    user: "Maestra Ana",
    handle: "@ana_maestro",
    time: "hace 2h",
    initials: "MA",
    avatarBg: "#7C3AED",
    text: "¡Terminamos el módulo de Felicidad! 🎉 Los niños aprendieron palabras nuevas: alegría, sonrisa, abrazo... ¿Cuál es su favorita? 📚",
    likes: 12,
    comments: 4,
    reposts: 2,
  },
  {
    id: 2,
    user: "Coordinadora Lucía",
    handle: "@lucia_coord",
    time: "hace 5h",
    initials: "CL",
    avatarBg: "#D97706",
    text: "Recordatorio: sesión de lectura grupal mañana a las 10:00 AM. ¡No olviden sus libros! 📖",
    likes: 8,
    comments: 6,
    reposts: 3,
  },
];

const calendarEvents = [
  { id: 1, group: "Grupo 1", time: "10:00 AM", minutesLeft: 30,  color: BRAND },
  { id: 2, group: "Grupo 2", time: "2:00 PM",  minutesLeft: 240, color: "#7C3AED" },
  { id: 3, group: "Grupo 3", time: "4:30 PM",  minutesLeft: 390, color: "#D97706" },
];

function timeLabel(min: number) {
  if (min < 60) return `En ${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `En ${h}h` : `En ${h}h ${m}min`;
}

export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="px-5 pt-10 pb-7 relative overflow-hidden shrink-0"
        style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
      >
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-20 bg-white" />
        <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full opacity-10 bg-white" />
        <div className="relative flex items-center gap-3">
          <div className="bg-white rounded-2xl p-1.5 shadow-sm shrink-0">
            <ImageWithFallback
              src={logoImg}
              alt="Sueños y Letras"
              className="w-11 h-11 rounded-xl object-cover"
            />
          </div>
          <div>
            <p className="text-white/75" style={{ fontSize: "0.75rem" }}>Sueños y Letras</p>
            <p className="text-white/90" style={{ fontSize: "0.95rem" }}>Bienvenida,</p>
            <h1 className="text-white" style={{ fontSize: "1.2rem", fontWeight: 800, lineHeight: 1.1 }}>
              María Reneé
            </h1>
          </div>
        </div>
      </header>

      {/* ── Scrollable body ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

        {/* Mis Módulos */}
        <section>
          <SectionHeader title="Mis Módulos" sub="3 activos" />
          <div className="flex gap-2 mb-3">
            {modules.map(m => (
              <button
                key={m.id}
                onClick={() => navigate(`/module/${m.id}`)}
                className="flex-1 rounded-2xl py-3 flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                style={{ background: m.bg, border: `1.5px solid ${m.border}30` }}
              >
                <span style={{ fontSize: "1.6rem" }}>{m.emoji}</span>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: m.text, textAlign: "center" }}>
                  {m.name}
                </span>
              </button>
            ))}
          </div>
          <PrimaryButton label="Ver Módulos" icon={<BookOpen size={14} />} onClick={() => navigate("/modules")} />
        </section>

        {/* Foro */}
        <section>
          <SectionHeader title="Foro" sub="2 nuevos posts" />
          <div className="space-y-2 mb-3">
            {foroPosts.map(post => (
              <a
                key={post.id}
                href="#"
                className="block rounded-2xl bg-white p-3.5 no-underline transition-shadow hover:shadow-sm"
                style={{ border: "1.5px solid #E4F4F3" }}
              >
                <div className="flex gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ background: post.avatarBg, fontSize: "0.65rem", fontWeight: 800 }}
                  >
                    {post.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-1">
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_DARK }}>{post.user}</span>
                      <span style={{ fontSize: "0.68rem", color: TEXT_MUTED }}>{post.handle}</span>
                      <span style={{ fontSize: "0.68rem", color: TEXT_MUTED }}>· {post.time}</span>
                    </div>
                    <p style={{ fontSize: "0.76rem", color: TEXT_MED, marginTop: "3px", lineHeight: 1.45 }}>
                      {post.text}
                    </p>
                    <div className="flex gap-4 mt-2">
                      <Stat icon={<MessageCircle size={11} />} count={post.comments} />
                      <Stat icon={<Repeat2 size={11} />}      count={post.reposts}  />
                      <Stat icon={<Heart size={11} />}         count={post.likes}    />
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
          <OutlineButton label="Ver Foro" onClick={() => navigate("/foro")} />
        </section>

        {/* Mi Calendario */}
        <section>
          <SectionHeader title="Mi Calendario" sub="Hoy · jue 4 jun" />
          <div className="rounded-2xl bg-white overflow-hidden mb-3" style={{ border: "1.5px solid #E4F4F3" }}>
            {calendarEvents.map((ev, i) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < calendarEvents.length - 1 ? "1px solid #F0F5F5" : "none" }}
              >
                <div className="w-1 h-9 rounded-full shrink-0" style={{ background: ev.color }} />
                <div className="flex-1">
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: TEXT_DARK }}>{ev.group}</p>
                  <p style={{ fontSize: "0.7rem", color: TEXT_MUTED }}>{ev.time}</p>
                </div>
                <div
                  className="flex items-center gap-1"
                  style={{ color: ev.minutesLeft <= 60 ? "#E53E3E" : TEXT_MUTED, fontSize: "0.7rem" }}
                >
                  <Clock size={11} />
                  <span style={{ fontWeight: ev.minutesLeft <= 60 ? 700 : 400 }}>
                    {timeLabel(ev.minutesLeft)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <OutlineButton label="Ver Calendario" icon={<Calendar size={14} />} onClick={() => navigate("/calendar")} />
        </section>

        <div className="h-2" />
      </div>

      {/* ── Bottom Nav ──────────────────────────────────────────── */}
      <BottomNav
        left={{
          icon: <User size={22} color={BRAND} />,
          label: "Mi Perfil",
          onClick: () => navigate("/profile"),
        }}
        right={{
          icon: <HelpCircle size={22} color={BRAND} />,
          label: "Preguntas Frecuentes",
          onClick: () => navigate("/faq"),
        }}
      />
    </div>
  );
}

/* helpers */
function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: TEXT_DARK }}>{title}</h2>
      <span style={{ fontSize: "0.68rem", color: BRAND, fontWeight: 600 }}>{sub}</span>
    </div>
  );
}

function PrimaryButton({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 rounded-xl text-white flex items-center justify-center gap-2 transition-all active:scale-95"
      style={{
        background: `linear-gradient(90deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`,
        fontSize: "0.85rem",
        fontWeight: 700,
      }}
    >
      {icon}{label}
    </button>
  );
}

function OutlineButton({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 rounded-xl bg-white flex items-center justify-center gap-2 transition-all active:scale-95"
      style={{ border: `1.5px solid ${BRAND}`, color: BRAND, fontSize: "0.85rem", fontWeight: 700 }}
    >
      {icon}{label}<ChevronRight size={14} />
    </button>
  );
}

function Stat({ icon, count }: { icon: React.ReactNode; count: number }) {
  return (
    <span className="flex items-center gap-1" style={{ fontSize: "0.68rem", color: TEXT_MUTED }}>
      {icon} {count}
    </span>
  );
}

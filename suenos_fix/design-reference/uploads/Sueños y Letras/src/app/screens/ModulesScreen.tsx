import { useNavigate } from "react-router";
import { BookOpen, Video, Headphones, FileText, MessageSquare, ChevronRight, Home, HelpCircle } from "lucide-react";
import logoImg from "figma:asset/309521523_406445261650683_3586315977316360400_n.jpg";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { BottomNav } from "../components/BottomNav";

const BRAND      = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const TEXT_DARK  = "#1A3A38";
const TEXT_MED   = "#4A6E6B";
const TEXT_MUTED = "#717182";

const MODULES = [
  {
    id: "felicidad",
    name: "Felicidad",
    emoji: "😊",
    color: "#F0B429",
    gradient: "linear-gradient(135deg,#FFE77A,#F6C90E)",
    bg: "#FFFBEB",
    border: "#FEF08A",
    description: "Exploramos la alegría, la sonrisa y los momentos que nos llenan de felicidad. Los niños aprenden palabras y emociones positivas a través de historias inspiradoras.",
    pdfs: 4, videos: 3, audios: 2,
  },
  {
    id: "enojo",
    name: "Enojo",
    emoji: "😠",
    color: "#E53E3E",
    gradient: "linear-gradient(135deg,#FCA5A5,#EF4444)",
    bg: "#FFF5F5",
    border: "#FED7D7",
    description: "Aprendemos a reconocer y canalizar la ira de manera saludable. Los niños descubren que el enojo es una emoción natural que podemos manejar con palabras.",
    pdfs: 3, videos: 2, audios: 3,
  },
  {
    id: "desagrado",
    name: "Desagrado",
    emoji: "🤢",
    color: "#38A169",
    gradient: "linear-gradient(135deg,#86EFAC,#22C55E)",
    bg: "#F0FFF4",
    border: "#BBF7D0",
    description: "Exploramos la incomodidad y el rechazo con empatía. Los niños aprenden a expresar lo que no les gusta de forma respetuosa y asertiva.",
    pdfs: 3, videos: 3, audios: 2,
  },
  {
    id: "tristeza",
    name: "Tristeza",
    emoji: "😢",
    color: "#4299E1",
    gradient: "linear-gradient(135deg,#93C5FD,#3B82F6)",
    bg: "#EBF8FF",
    border: "#BEE3F8",
    description: "Aprendemos que está bien sentirse triste y cómo encontrar consuelo en las palabras y los libros. La lectura como refugio en momentos difíciles.",
    pdfs: 4, videos: 2, audios: 3,
  },
];

export function ModulesScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="px-5 pt-10 pb-6 relative overflow-hidden shrink-0"
        style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 bg-white" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full opacity-10 bg-white" />
        <div className="relative flex items-center gap-3">
          <div className="bg-white rounded-2xl p-1.5 shadow-sm shrink-0">
            <ImageWithFallback src={logoImg} alt="Sueños y Letras" className="w-10 h-10 rounded-xl object-cover" />
          </div>
          <div>
            <p className="text-white/70" style={{ fontSize: "0.7rem" }}>Sueños y Letras</p>
            <h1 className="text-white" style={{ fontSize: "1.15rem", fontWeight: 800 }}>Mis Módulos</h1>
          </div>
        </div>
      </header>

      {/* ── Module list ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {MODULES.map(mod => (
          <div
            key={mod.id}
            className="rounded-2xl overflow-hidden"
            style={{ border: `1.5px solid ${mod.border}`, background: mod.bg }}
          >
            {/* card header */}
            <div className="px-4 py-4 flex items-start gap-3" style={{ background: mod.gradient, opacity: 1 }}>
              <span style={{ fontSize: "2.5rem" }}>{mod.emoji}</span>
              <div className="flex-1">
                <h2 className="text-white" style={{ fontSize: "1.05rem", fontWeight: 800 }}>
                  Módulo de {mod.name}
                </h2>
                <p className="text-white/80" style={{ fontSize: "0.72rem", marginTop: "2px", lineHeight: 1.4 }}>
                  {mod.description}
                </p>
              </div>
            </div>

            {/* content summary */}
            <div className="px-4 py-3 flex gap-3">
              <ContentBadge icon={<FileText size={12} />}   label={`${mod.pdfs} PDFs`}      color={mod.color} />
              <ContentBadge icon={<Video size={12} />}      label={`${mod.videos} Videos`}  color={mod.color} />
              <ContentBadge icon={<Headphones size={12} />} label={`${mod.audios} Audios`}  color={mod.color} />
            </div>

            {/* action buttons */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={() => navigate(`/module/${mod.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white transition-all active:scale-[0.97]"
                style={{ background: mod.color, fontSize: "0.78rem", fontWeight: 700 }}
              >
                <BookOpen size={13} />
                Ver módulo
              </button>
              <button
                onClick={() => navigate(`/foro?module=${mod.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all active:scale-[0.97]"
                style={{
                  border:     `1.5px solid ${mod.color}`,
                  color:       mod.color,
                  background: "white",
                  fontSize:   "0.78rem",
                  fontWeight: 700,
                }}
              >
                <MessageSquare size={13} />
                Ver en Foro
              </button>
            </div>
          </div>
        ))}

        <div className="h-2" />
      </div>

      {/* ── Bottom Nav ──────────────────────────────────────────── */}
      <BottomNav
        left={{ icon: <Home size={22} color={BRAND} />, label: "Inicio",                onClick: () => navigate("/") }}
        right={{ icon: <HelpCircle size={22} color={BRAND} />, label: "Preguntas Frecuentes", onClick: () => navigate("/faq") }}
      />
    </div>
  );
}

function ContentBadge({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
      style={{ background: `${color}15`, color }}
    >
      {icon}
      <span style={{ fontSize: "0.68rem", fontWeight: 700 }}>{label}</span>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  FileText,
  Video,
  Headphones,
  Play,
  Pause,
  X,
  Maximize2,
  ChevronRight,
  Home,
  HelpCircle,
  Volume2,
} from "lucide-react";
import { BottomNav } from "../components/BottomNav";

/* ─── Brand tokens ─────────────────────────────────────────────────── */
const BRAND     = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const TEXT_DARK  = "#1A3A38";
const TEXT_MED   = "#4A6E6B";
const TEXT_MUTED = "#717182";

/* ─── Module metadata ──────────────────────────────────────────────── */
const MODULE_META: Record<string, { label: string; emoji: string; color: string; gradient: string }> = {
  felicidad: { label: "Felicidad", emoji: "😊", color: "#F0B429", gradient: "linear-gradient(135deg,#F6C90E,#E9A800)" },
  enojo:     { label: "Enojo",     emoji: "😠", color: "#E53E3E", gradient: "linear-gradient(135deg,#FC5858,#C53030)" },
  desagrado: { label: "Desagrado", emoji: "🤢", color: "#38A169", gradient: "linear-gradient(135deg,#4DC982,#2F855A)" },
  tristeza:  { label: "Tristeza",  emoji: "😢", color: "#4299E1", gradient: "linear-gradient(135deg,#63B3ED,#2B6CB0)" },
};
const DEFAULT_META = { label: "Alegría", emoji: "✨", color: BRAND, gradient: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` };

/* ─── PDF content ──────────────────────────────────────────────────── */
type PdfItem = { number: string; title: string; level: 1 | 2 };

const PDF_CONTENT: PdfItem[] = [
  { level: 1, number: "1",   title: "Introducción" },
  { level: 2, number: "1.1", title: "Material del módulo" },
  { level: 2, number: "1.2", title: "Objetivos de aprendizaje" },
  { level: 1, number: "2",   title: "Historias Acerca de la Alegría" },
  { level: 2, number: "2.1", title: "El Principito" },
  { level: 2, number: "2.2", title: "Matilda" },
  { level: 2, number: "2.3", title: "Pollyanna" },
  { level: 1, number: "3",   title: "Actividades Creativas" },
  { level: 2, number: "3.1", title: "Dibuja tu emoción" },
  { level: 2, number: "3.2", title: "Escribe sobre un momento feliz" },
  { level: 2, number: "3.3", title: "Juego de palabras emocionales" },
  { level: 1, number: "4",   title: "Evaluación" },
  { level: 2, number: "4.1", title: "Preguntas de reflexión" },
  { level: 2, number: "4.2", title: "Rúbrica de participación" },
];

/* ─── Video content ────────────────────────────────────────────────── */
type VideoItem = { id: number; title: string; description: string; duration: string; color: string };

const VIDEOS: VideoItem[] = [
  {
    id: 1,
    title: "La Alegría de Leer",
    description: "Corto animado sobre un niño que descubre el amor por los libros.",
    duration: "8 min",
    color: "#7C3AED",
  },
  {
    id: 2,
    title: "Celebrando con Palabras",
    description: "Historia de una niña que usa las palabras para expresar su felicidad.",
    duration: "12 min",
    color: "#D97706",
  },
  {
    id: 3,
    title: "El Libro Mágico",
    description: "Cuento animado sobre los poderes especiales que tienen los libros.",
    duration: "6 min",
    color: "#38A169",
  },
];

/* ─── Audiocuento content ──────────────────────────────────────────── */
type AudioItem = { id: number; title: string; description: string; duration: string; totalSeconds: number };

const AUDIOCUENTOS: AudioItem[] = [
  {
    id: 1,
    title: "El Principito",
    description: "Antoine de Saint-Exupéry. Un cuento sobre la amistad y la alegría de descubrir el mundo.",
    duration: "18 min",
    totalSeconds: 1080,
  },
  {
    id: 2,
    title: "Matilda",
    description: "Roald Dahl. La historia de una niña prodigio que encuentra alegría en los libros.",
    duration: "24 min",
    totalSeconds: 1440,
  },
  {
    id: 3,
    title: "La Tortuga y la Liebre",
    description: "Fábula clásica sobre la perseverancia y la alegría de superarse a uno mismo.",
    duration: "10 min",
    totalSeconds: 600,
  },
];

/* ─── Tab type ─────────────────────────────────────────────────────── */
type Tab = "pdf" | "video" | "audiocuento";

/* ═══════════════════════════════════════════════════════════════════ */
export function ModuleScreen() {
  const { name = "alegria" } = useParams<{ name: string }>();
  const navigate = useNavigate();

  const meta = MODULE_META[name] ?? DEFAULT_META;

  const [activeTab, setActiveTab] = useState<Tab>("pdf");
  const [fullscreenVideo, setFullscreenVideo] = useState<VideoItem | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* simulate audio progress */
  useEffect(() => {
    if (playingAudioId === null) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setAudioProgress(prev => {
        const track = AUDIOCUENTOS.find(a => a.id === playingAudioId);
        if (!track) return prev;
        const current = prev[playingAudioId] ?? 0;
        if (current >= track.totalSeconds) {
          clearInterval(intervalRef.current!);
          setPlayingAudioId(null);
          return { ...prev, [playingAudioId]: 0 };
        }
        return { ...prev, [playingAudioId]: current + 1 };
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playingAudioId]);

  function toggleAudio(id: number) {
    if (playingAudioId === id) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(id);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="px-4 pt-10 pb-5 relative overflow-hidden shrink-0"
        style={{ background: meta.gradient }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 bg-white" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full opacity-10 bg-white" />

        {/* back button */}
        <button
          onClick={() => navigate(-1)}
          className="relative mb-4 flex items-center gap-1.5 text-white/80 transition-opacity active:opacity-60"
        >
          <ArrowLeft size={18} />
          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Volver</span>
        </button>

        {/* title row */}
        <div className="relative flex items-center gap-3">
          <span style={{ fontSize: "2rem" }}>{meta.emoji}</span>
          <div>
            <p className="text-white/70" style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Módulo
            </p>
            <h1 className="text-white" style={{ fontSize: "1.2rem", fontWeight: 800, lineHeight: 1.1 }}>
              Módulo de {meta.label}
            </h1>
          </div>
        </div>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div
        className="flex gap-2 px-4 py-3 bg-white shrink-0"
        style={{ borderBottom: "1px solid #E4F4F3" }}
      >
        {(["pdf", "video", "audiocuento"] as Tab[]).map(tab => {
          const active = activeTab === tab;
          const icons: Record<Tab, React.ReactNode> = {
            pdf:         <FileText  size={14} />,
            video:       <Video     size={14} />,
            audiocuento: <Headphones size={14} />,
          };
          const labels: Record<Tab, string> = {
            pdf:         "PDF",
            video:       "Video",
            audiocuento: "Audiocuento",
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all active:scale-95"
              style={{
                background:  active ? meta.color : "#F5FEFE",
                color:       active ? "white"    : TEXT_MED,
                border:      active ? "none"     : `1.5px solid #E0F0EF`,
                fontWeight:  active ? 700 : 500,
                fontSize:    "0.75rem",
              }}
            >
              {icons[tab]}
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Content block ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* PDF View */}
        {activeTab === "pdf" && (
          <div className="space-y-1">
            {PDF_CONTENT.map((item, i) => (
              <button
                key={i}
                className="w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#F0FAFA] active:bg-[#E0F5F3]"
              >
                <span
                  className="shrink-0 mt-0.5"
                  style={{
                    fontSize:   item.level === 1 ? "0.82rem" : "0.75rem",
                    fontWeight: item.level === 1 ? 800 : 600,
                    color:      item.level === 1 ? meta.color : TEXT_MUTED,
                    minWidth:   "2rem",
                  }}
                >
                  {item.number}
                </span>
                <span
                  style={{
                    fontSize:    item.level === 1 ? "0.88rem" : "0.8rem",
                    fontWeight:  item.level === 1 ? 700 : 400,
                    color:       item.level === 1 ? TEXT_DARK : TEXT_MED,
                    paddingLeft: item.level === 2 ? "0.5rem" : "0",
                  }}
                >
                  {item.title}
                </span>
                {item.level === 1 && (
                  <ChevronRight size={14} className="ml-auto shrink-0 mt-0.5" style={{ color: TEXT_MUTED }} />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Video View */}
        {activeTab === "video" && (
          <div className="space-y-3">
            {VIDEOS.map(video => (
              <div
                key={video.id}
                className="rounded-2xl bg-white overflow-hidden"
                style={{ border: "1.5px solid #E4F4F3" }}
              >
                {/* thumbnail */}
                <div
                  className="relative w-full flex items-center justify-center"
                  style={{ height: "130px", background: `linear-gradient(135deg,${video.color}22,${video.color}44)` }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(circle at 30% 40%, ${video.color}33 0%, transparent 60%)`,
                    }}
                  />
                  {/* decorative lines */}
                  <div className="absolute bottom-0 left-0 right-0 h-8 opacity-10"
                    style={{ background: `repeating-linear-gradient(90deg, ${video.color} 0px, ${video.color} 2px, transparent 2px, transparent 20px)` }}
                  />
                  <button
                    onClick={() => setFullscreenVideo(video)}
                    className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
                    style={{ background: video.color }}
                  >
                    <Play size={22} color="white" fill="white" style={{ marginLeft: "3px" }} />
                  </button>
                  <span
                    className="absolute bottom-2 right-3"
                    style={{ fontSize: "0.65rem", fontWeight: 700, color: video.color, background: `${video.color}15`, borderRadius: "6px", padding: "2px 6px" }}
                  >
                    {video.duration}
                  </span>
                </div>
                {/* info */}
                <div className="px-4 py-3 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p style={{ fontSize: "0.85rem", fontWeight: 700, color: TEXT_DARK }}>{video.title}</p>
                    <p style={{ fontSize: "0.72rem", color: TEXT_MED, marginTop: "2px", lineHeight: 1.4 }}>
                      {video.description}
                    </p>
                  </div>
                  <button
                    onClick={() => setFullscreenVideo(video)}
                    className="shrink-0 mt-0.5 p-1.5 rounded-lg transition-colors"
                    style={{ color: video.color, background: `${video.color}12` }}
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Audiocuento View */}
        {activeTab === "audiocuento" && (
          <div className="space-y-3">
            {AUDIOCUENTOS.map(audio => {
              const isPlaying = playingAudioId === audio.id;
              const progress  = audioProgress[audio.id] ?? 0;
              const pct       = (progress / audio.totalSeconds) * 100;

              return (
                <div
                  key={audio.id}
                  className="rounded-2xl bg-white p-4"
                  style={{ border: `1.5px solid ${isPlaying ? BRAND : "#E4F4F3"}` }}
                >
                  <div className="flex items-start gap-3">
                    {/* play button */}
                    <button
                      onClick={() => toggleAudio(audio.id)}
                      className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-90"
                      style={{ background: isPlaying ? BRAND : "#F0FAFA", border: `2px solid ${isPlaying ? BRAND : "#D0ECEB"}` }}
                    >
                      {isPlaying
                        ? <Pause  size={18} color="white" fill="white" />
                        : <Play   size={18} color={BRAND} fill={BRAND} style={{ marginLeft: "2px" }} />
                      }
                    </button>

                    {/* meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: TEXT_DARK }}>{audio.title}</p>
                        <span style={{ fontSize: "0.65rem", fontWeight: 600, color: TEXT_MUTED, shrink: 0, whiteSpace: "nowrap" }}>
                          {audio.duration}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.72rem", color: TEXT_MED, marginTop: "2px", lineHeight: 1.4 }}>
                        {audio.description}
                      </p>

                      {/* progress bar — shown when playing or has progress */}
                      {(isPlaying || progress > 0) && (
                        <div className="mt-3">
                          <div className="w-full h-1.5 rounded-full bg-[#E0F0EF] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: BRAND }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span style={{ fontSize: "0.6rem", color: TEXT_MUTED }}>{formatTime(progress)}</span>
                            <span style={{ fontSize: "0.6rem", color: TEXT_MUTED }}>{audio.duration}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* waveform decoration when playing */}
                  {isPlaying && (
                    <div className="flex items-end gap-0.5 mt-3 h-5 justify-center opacity-60">
                      {Array.from({ length: 28 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 rounded-full"
                          style={{
                            height:    `${Math.random() * 70 + 30}%`,
                            background: BRAND,
                            animation: `pulse ${0.4 + Math.random() * 0.6}s ease-in-out infinite alternate`,
                            animationDelay: `${i * 0.04}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="h-2" />
      </div>

      {/* ── Bottom Nav ──────────────────────────────────────────── */}
      <BottomNav
        left={{
          icon: <Home size={22} color={BRAND} />,
          label: "Inicio",
          onClick: () => navigate("/"),
        }}
        right={{
          icon: <HelpCircle size={22} color={BRAND} />,
          label: "Preguntas Frecuentes",
        }}
      />

      {/* ── Fullscreen Video Overlay ─────────────────────────────── */}
      {fullscreenVideo && (
        <FullscreenVideo video={fullscreenVideo} onClose={() => setFullscreenVideo(null)} />
      )}
    </div>
  );
}

/* ─── Fullscreen video overlay ─────────────────────────────────────── */
function FullscreenVideo({ video, onClose }: { video: VideoItem; onClose: () => void }) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const totalSeconds = 480; /* placeholder 8 min */
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= totalSeconds) { clearInterval(intervalRef.current!); setPlaying(false); return 0; }
          return p + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  const pct = (progress / totalSeconds) * 100;

  function fmt(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#0A0A0A" }}
    >
      {/* video area */}
      <div
        className="flex-1 flex items-center justify-center relative"
        style={{ background: `radial-gradient(ellipse at center, ${video.color}22 0%, #0A0A0A 70%)` }}
      >
        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-10"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <X size={18} color="white" />
        </button>

        {/* title */}
        <div className="absolute top-4 left-4">
          <p className="text-white/60" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Reproduciendo
          </p>
          <p className="text-white" style={{ fontSize: "0.9rem", fontWeight: 700 }}>{video.title}</p>
        </div>

        {/* big play */}
        <button
          onClick={() => setPlaying(p => !p)}
          className="w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-90"
          style={{ background: video.color, boxShadow: `0 0 40px ${video.color}66` }}
        >
          {playing
            ? <Pause size={30} color="white" fill="white" />
            : <Play  size={30} color="white" fill="white" style={{ marginLeft: "4px" }} />
          }
        </button>

        {/* animated dots when playing */}
        {playing && (
          <div className="absolute bottom-8 flex gap-1.5">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: video.color,
                  animation: `bounce 0.8s ease-in-out infinite`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* controls */}
      <div className="px-6 pb-10 pt-4" style={{ background: "#111" }}>
        <p className="text-white/60 mb-3 text-center" style={{ fontSize: "0.75rem" }}>{video.description}</p>

        {/* progress */}
        <div className="w-full h-1 rounded-full mb-1 overflow-hidden" style={{ background: "#333" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: video.color }}
          />
        </div>
        <div className="flex justify-between">
          <span style={{ fontSize: "0.65rem", color: "#888" }}>{fmt(progress)}</span>
          <span style={{ fontSize: "0.65rem", color: "#888" }}>{video.duration}</span>
        </div>

        {/* controls row */}
        <div className="flex items-center justify-center gap-8 mt-4">
          <button style={{ color: "#888" }}>
            <Volume2 size={20} />
          </button>
          <button
            onClick={() => setPlaying(p => !p)}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-transform active:scale-90"
            style={{ background: video.color }}
          >
            {playing
              ? <Pause size={22} color="white" fill="white" />
              : <Play  size={22} color="white" fill="white" style={{ marginLeft: "3px" }} />
            }
          </button>
          <button onClick={onClose} style={{ color: "#888" }}>
            <X size={20} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes pulse {
          from { opacity: 0.4; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

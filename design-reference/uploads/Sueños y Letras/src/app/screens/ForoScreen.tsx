import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Home, HelpCircle, Plus, MessageCircle, Heart, Repeat2, X,
  Image as ImageIcon, Video, ArrowLeft, Send,
} from "lucide-react";
import { BottomNav } from "../components/BottomNav";
import logoImg from "figma:asset/309521523_406445261650683_3586315977316360400_n.jpg";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const BRAND      = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const TEXT_DARK  = "#1A3A38";
const TEXT_MED   = "#4A6E6B";
const TEXT_MUTED = "#717182";

type PostType = "text" | "image" | "video";
type Filter   = "todos" | "felicidad" | "enojo" | "desagrado" | "tristeza" | "general";

interface Post {
  id: number;
  user: string;
  handle: string;
  initials: string;
  avatarBg: string;
  time: string;
  text: string;
  type: PostType;
  imageBg?: string;
  videoBg?: string;
  videoTitle?: string;
  tag: string;
  tagColor: string;
  likes: number;
  comments: number;
  reposts: number;
  liked: boolean;
}

const INITIAL_POSTS: Post[] = [
  {
    id: 1, user: "Maestra Ana", handle: "@ana_maestro", initials: "MA",
    avatarBg: "#7C3AED", time: "hace 2h",
    text: "¡Terminamos el módulo de Felicidad! 🎉 Los niños aprendieron palabras nuevas: alegría, sonrisa, abrazo... ¿Cuál es su favorita? 📚",
    type: "text", tag: "Felicidad", tagColor: "#F0B429",
    likes: 12, comments: 4, reposts: 2, liked: false,
  },
  {
    id: 2, user: "Coordinadora Lucía", handle: "@lucia_coord", initials: "CL",
    avatarBg: "#D97706", time: "hace 5h",
    text: "Compartiendo la actividad de hoy: los niños dibujaron cómo se ven cuando están felices. ¡Los resultados son increíbles! 🎨",
    type: "image", imageBg: "linear-gradient(135deg,#FCD34D,#F59E0B)",
    tag: "Felicidad", tagColor: "#F0B429",
    likes: 28, comments: 9, reposts: 5, liked: true,
  },
  {
    id: 3, user: "Prof. Carlos", handle: "@carlos_prof", initials: "PC",
    avatarBg: "#0EA5E9", time: "hace 1d",
    text: "Hemos estado trabajando con el módulo de Enojo. Ver a los niños aprender a expresar sus sentimientos con palabras en lugar de gritos es un logro increíble. 🌱",
    type: "text", tag: "Enojo", tagColor: "#E53E3E",
    likes: 19, comments: 7, reposts: 3, liked: false,
  },
  {
    id: 4, user: "Sueños y Letras", handle: "@suenosyletras", initials: "SL",
    avatarBg: BRAND, time: "hace 2d",
    text: "¡Nuevo audiocuento disponible! 'La Tortuga y la Liebre' ahora está en el módulo de Tristeza. Escúchenlo con los niños y compartan sus reflexiones 🐢📖",
    type: "video", videoBg: "linear-gradient(135deg,#93C5FD,#3B82F6)", videoTitle: "La Tortuga y la Liebre",
    tag: "Tristeza", tagColor: "#4299E1",
    likes: 45, comments: 12, reposts: 18, liked: true,
  },
  {
    id: 5, user: "Voluntaria Sofía", handle: "@sofia_vol", initials: "VS",
    avatarBg: "#EC4899", time: "hace 3d",
    text: "Primera semana con el módulo de Desagrado y los niños ya están usando vocabulario nuevo para describir lo que no les gusta. ¡El progreso es real! 💪",
    type: "text", tag: "Desagrado", tagColor: "#38A169",
    likes: 15, comments: 6, reposts: 2, liked: false,
  },
  {
    id: 6, user: "Maestra Rebeca", handle: "@rebeca_mae", initials: "MR",
    avatarBg: "#8B5CF6", time: "hace 4d",
    text: "Foto de nuestra clase practicando la lectura en voz alta. ¡Qué orgullo verlos crecer! 📸",
    type: "image", imageBg: "linear-gradient(135deg,#C4B5FD,#8B5CF6)",
    tag: "General", tagColor: TEXT_MUTED,
    likes: 33, comments: 14, reposts: 7, liked: false,
  },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos",     label: "Todos"     },
  { id: "felicidad", label: "Felicidad" },
  { id: "enojo",     label: "Enojo"     },
  { id: "desagrado", label: "Desagrado" },
  { id: "tristeza",  label: "Tristeza"  },
  { id: "general",   label: "General"   },
];

export function ForoScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moduleParam = searchParams.get("module") as Filter | null;

  const [filter,      setFilter]      = useState<Filter>(moduleParam ?? "todos");
  const [posts,       setPosts]       = useState<Post[]>(INITIAL_POSTS);
  const [openPost,    setOpenPost]    = useState<Post | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  const filtered = filter === "todos"
    ? posts
    : posts.filter(p => p.tag.toLowerCase() === filter);

  function toggleLike(id: number) {
    setPosts(prev => prev.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
  }

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="px-5 pt-10 pb-4 relative overflow-hidden shrink-0"
        style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 bg-white" />
        <div className="relative flex items-center gap-3">
          <div className="bg-white rounded-2xl p-1.5 shadow-sm shrink-0">
            <ImageWithFallback src={logoImg} alt="Sueños y Letras" className="w-10 h-10 rounded-xl object-cover" />
          </div>
          <div>
            <p className="text-white/70" style={{ fontSize: "0.7rem" }}>Sueños y Letras</p>
            <h1 className="text-white" style={{ fontSize: "1.15rem", fontWeight: 800 }}>Foro</h1>
          </div>
        </div>

        {/* filter scroll */}
        <div className="relative mt-4 -mx-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-2 px-5 pb-1">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="shrink-0 px-3.5 py-1.5 rounded-full transition-all"
                style={{
                  background: filter === f.id ? "white"              : "rgba(255,255,255,0.2)",
                  color:      filter === f.id ? BRAND_DARK           : "white",
                  fontSize:   "0.72rem",
                  fontWeight: filter === f.id ? 700 : 500,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Post feed ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: "#F0F5F5" }}>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <p style={{ fontSize: "2.5rem", marginBottom: "8px" }}>💬</p>
            <p style={{ fontSize: "0.9rem", fontWeight: 700, color: TEXT_DARK }}>Sin publicaciones</p>
            <p style={{ fontSize: "0.75rem", color: TEXT_MUTED, marginTop: "4px" }}>Sé el primero en publicar en este tema.</p>
          </div>
        )}
        {filtered.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onOpen={() => setOpenPost(post)}
            onLike={() => toggleLike(post.id)}
          />
        ))}
        <div className="h-20" />
      </div>

      {/* ── FAB ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowCompose(true)}
        className="absolute right-5 flex items-center justify-center w-14 h-14 rounded-full shadow-lg z-20 transition-transform active:scale-90"
        style={{ bottom: "88px", background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }}
      >
        <Plus size={24} color="white" />
      </button>

      {/* ── Bottom Nav ──────────────────────────────────────────── */}
      <BottomNav
        left={{ icon: <Home size={22} color={BRAND} />, label: "Inicio",                onClick: () => navigate("/") }}
        right={{ icon: <HelpCircle size={22} color={BRAND} />, label: "Preguntas Frecuentes", onClick: () => navigate("/faq") }}
      />

      {/* ── Thread detail overlay ───────────────────────────────── */}
      {openPost && (
        <ThreadDetail post={openPost} onClose={() => setOpenPost(null)} onLike={() => { toggleLike(openPost.id); setOpenPost(p => p ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : null); }} />
      )}

      {/* ── Compose overlay ─────────────────────────────────────── */}
      {showCompose && (
        <ComposeOverlay onClose={() => setShowCompose(false)} onPost={(text, tag) => {
          setPosts(prev => [{
            id: Date.now(), user: "María Reneé", handle: "@maria_r", initials: "MR",
            avatarBg: BRAND, time: "ahora mismo", text, type: "text",
            tag, tagColor: BRAND, likes: 0, comments: 0, reposts: 0, liked: false,
          }, ...prev]);
          setShowCompose(false);
        }} />
      )}
    </div>
  );
}

/* ── Post card ──────────────────────────────────────────────────────── */
function PostCard({ post, onOpen, onLike }: { post: Post; onOpen: () => void; onLike: () => void }) {
  return (
    <div className="px-4 py-4 bg-white cursor-pointer hover:bg-[#FAFFFE] transition-colors" onClick={onOpen}>
      <div className="flex gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ background: post.avatarBg, fontSize: "0.62rem", fontWeight: 800 }}
        >
          {post.initials}
        </div>
        <div className="flex-1 min-w-0">
          {/* user row */}
          <div className="flex flex-wrap items-baseline gap-x-1 mb-1">
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: TEXT_DARK }}>{post.user}</span>
            <span style={{ fontSize: "0.68rem", color: TEXT_MUTED }}>{post.handle} · {post.time}</span>
            <span
              className="ml-auto px-2 py-0.5 rounded-full shrink-0"
              style={{ fontSize: "0.6rem", fontWeight: 700, color: post.tagColor, background: `${post.tagColor}18` }}
            >
              {post.tag}
            </span>
          </div>

          {/* text */}
          <p style={{ fontSize: "0.8rem", color: TEXT_MED, lineHeight: 1.5, marginBottom: "8px" }}>{post.text}</p>

          {/* media */}
          {post.type === "image" && (
            <div className="rounded-xl overflow-hidden mb-3" style={{ height: "100px", background: post.imageBg }}>
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon size={28} color="white" style={{ opacity: 0.7 }} />
              </div>
            </div>
          )}
          {post.type === "video" && (
            <div className="rounded-xl overflow-hidden mb-3 relative" style={{ height: "100px", background: post.videoBg }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
                  <Video size={18} color="white" />
                </div>
                <span className="text-white" style={{ fontSize: "0.7rem", fontWeight: 600 }}>{post.videoTitle}</span>
              </div>
            </div>
          )}

          {/* engagement */}
          <div className="flex gap-5" onClick={e => e.stopPropagation()}>
            <Engage icon={<MessageCircle size={14} />} count={post.comments} />
            <Engage icon={<Repeat2 size={14} />}       count={post.reposts}  />
            <button
              onClick={onLike}
              className="flex items-center gap-1.5 transition-colors"
              style={{ color: post.liked ? "#E53E3E" : TEXT_MUTED, fontSize: "0.72rem" }}
            >
              <Heart size={14} fill={post.liked ? "#E53E3E" : "none"} />
              {post.likes}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Thread detail overlay ──────────────────────────────────────────── */
function ThreadDetail({ post, onClose, onLike }: { post: Post; onClose: () => void; onLike: () => void }) {
  const [reply, setReply] = useState("");

  const SAMPLE_REPLIES = [
    { initials: "TP", bg: "#0EA5E9", user: "Teacher Pedro", text: "¡Qué bonito! Los niños están aprendiendo mucho. 🌟", time: "hace 1h" },
    { initials: "MJ", bg: "#EC4899", user: "Maestra Julia",  text: "Nos une el amor por la lectura 📖", time: "hace 45min" },
  ];

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#F5FEFE]">
      {/* header */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-4 bg-white" style={{ borderBottom: "1px solid #E0F0EF" }}>
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#F0FAFA" }}>
          <ArrowLeft size={18} color={TEXT_MED} />
        </button>
        <span style={{ fontSize: "0.9rem", fontWeight: 800, color: TEXT_DARK }}>Publicación</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* original post */}
        <div className="px-4 py-4 bg-white" style={{ borderBottom: "1px solid #E0F0EF" }}>
          <div className="flex gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: post.avatarBg, fontSize: "0.7rem", fontWeight: 800 }}>
              {post.initials}
            </div>
            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 700, color: TEXT_DARK }}>{post.user}</p>
              <p style={{ fontSize: "0.72rem", color: TEXT_MUTED }}>{post.handle}</p>
            </div>
            <span className="ml-auto px-2.5 py-1 rounded-full" style={{ fontSize: "0.62rem", fontWeight: 700, color: post.tagColor, background: `${post.tagColor}18` }}>
              {post.tag}
            </span>
          </div>
          <p style={{ fontSize: "0.9rem", color: TEXT_DARK, lineHeight: 1.6, marginBottom: "12px" }}>{post.text}</p>

          {post.type === "image" && (
            <div className="rounded-2xl overflow-hidden mb-3" style={{ height: "140px", background: post.imageBg }}>
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon size={36} color="white" style={{ opacity: 0.7 }} />
              </div>
            </div>
          )}
          {post.type === "video" && (
            <div className="rounded-2xl overflow-hidden mb-3 relative" style={{ height: "140px", background: post.videoBg }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                  <Video size={22} color="white" />
                </div>
                <span className="text-white" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{post.videoTitle}</span>
              </div>
            </div>
          )}

          <div className="flex gap-1 text-sm mb-3" style={{ color: TEXT_MUTED, fontSize: "0.72rem" }}>
            <span>{post.time}</span>
            <span>·</span>
            <span style={{ fontWeight: 600, color: TEXT_DARK }}>{post.likes + post.comments + post.reposts}</span>
            <span>interacciones</span>
          </div>

          <div className="flex gap-6 pt-3" style={{ borderTop: "1px solid #E0F0EF" }}>
            <Engage icon={<MessageCircle size={16} />} count={post.comments} />
            <Engage icon={<Repeat2 size={16} />}       count={post.reposts}  />
            <button onClick={onLike} className="flex items-center gap-1.5" style={{ color: post.liked ? "#E53E3E" : TEXT_MUTED, fontSize: "0.75rem" }}>
              <Heart size={16} fill={post.liked ? "#E53E3E" : "none"} />
              {post.likes}
            </button>
          </div>
        </div>

        {/* replies */}
        <div className="divide-y" style={{ borderColor: "#F0F5F5" }}>
          {SAMPLE_REPLIES.map((r, i) => (
            <div key={i} className="px-4 py-3 bg-white flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: r.bg, fontSize: "0.6rem", fontWeight: 800 }}>
                {r.initials}
              </div>
              <div>
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_DARK }}>{r.user}</span>
                  <span style={{ fontSize: "0.66rem", color: TEXT_MUTED }}>· {r.time}</span>
                </div>
                <p style={{ fontSize: "0.78rem", color: TEXT_MED, lineHeight: 1.45 }}>{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* reply bar */}
      <div className="px-4 py-3 bg-white flex items-center gap-2" style={{ borderTop: "1px solid #E0F0EF" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: BRAND, fontSize: "0.6rem", fontWeight: 800 }}>
          MR
        </div>
        <input
          placeholder="Escribe una respuesta..."
          value={reply}
          onChange={e => setReply(e.target.value)}
          className="flex-1 py-2 px-3 rounded-xl outline-none"
          style={{ border: "1.5px solid #D0ECEB", fontSize: "0.8rem", color: TEXT_DARK, background: "#F5FEFE" }}
        />
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: reply ? BRAND : "#D0ECEB" }}
        >
          <Send size={15} color="white" />
        </button>
      </div>
    </div>
  );
}

/* ── Compose overlay ────────────────────────────────────────────────── */
function ComposeOverlay({ onClose, onPost }: { onClose: () => void; onPost: (text: string, tag: string) => void }) {
  const [text, setText] = useState("");
  const [tag,  setTag]  = useState("General");
  const TAGS = ["General", "Felicidad", "Enojo", "Desagrado", "Tristeza"];

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#F5FEFE]">
      {/* header */}
      <div className="flex items-center justify-between px-4 pt-10 pb-4 bg-white" style={{ borderBottom: "1px solid #E0F0EF" }}>
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#F0FAFA" }}>
          <X size={18} color={TEXT_MED} />
        </button>
        <span style={{ fontSize: "0.9rem", fontWeight: 800, color: TEXT_DARK }}>Nueva publicación</span>
        <button
          onClick={() => { if (text.trim()) onPost(text.trim(), tag); }}
          disabled={!text.trim()}
          className="px-4 py-2 rounded-xl text-white transition-all active:scale-95"
          style={{ background: text.trim() ? BRAND : "#B0D8D6", fontSize: "0.8rem", fontWeight: 700 }}
        >
          Publicar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* author row */}
        <div className="flex gap-3 items-start">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: BRAND, fontSize: "0.7rem", fontWeight: 800 }}>
            MR
          </div>
          <textarea
            placeholder="¿Qué quieres compartir con la comunidad?"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            className="flex-1 resize-none outline-none py-2 px-3 rounded-xl"
            style={{ border: "1.5px solid #D0ECEB", fontSize: "0.85rem", color: TEXT_DARK, background: "white", lineHeight: 1.5 }}
          />
        </div>

        {/* tag selector */}
        <div>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "8px" }}>Módulo relacionado</p>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(t => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className="px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: tag === t ? BRAND : "#E8F8F7",
                  color:      tag === t ? "white" : TEXT_MED,
                  fontSize:   "0.75rem",
                  fontWeight: tag === t ? 700 : 500,
                  border:     `1.5px solid ${tag === t ? BRAND : "#C0E8E5"}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* media hint */}
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ border: "1.5px solid #D0ECEB", color: TEXT_MUTED, fontSize: "0.75rem" }}>
            <ImageIcon size={14} /> Imagen
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ border: "1.5px solid #D0ECEB", color: TEXT_MUTED, fontSize: "0.75rem" }}>
            <Video size={14} /> Video
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Tiny helper ────────────────────────────────────────────────────── */
function Engage({ icon, count }: { icon: React.ReactNode; count: number }) {
  return (
    <span className="flex items-center gap-1.5" style={{ color: TEXT_MUTED, fontSize: "0.72rem" }}>
      {icon} {count}
    </span>
  );
}

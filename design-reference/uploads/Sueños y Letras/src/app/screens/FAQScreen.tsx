import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, Home, User, HelpCircle } from "lucide-react";
import logoImg from "figma:asset/309521523_406445261650683_3586315977316360400_n.jpg";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { BottomNav } from "../components/BottomNav";

const BRAND      = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const TEXT_DARK  = "#1A3A38";
const TEXT_MED   = "#4A6E6B";
const TEXT_MUTED = "#717182";

type FaqItem     = { q: string; a: string };
type FaqCategory = { id: string; emoji: string; label: string; items: FaqItem[] };

const CATEGORIES: FaqCategory[] = [
  {
    id: "general",
    emoji: "📱",
    label: "General",
    items: [
      { q: "¿Qué es Sueños y Letras?", a: "Sueños y Letras es una organización dedicada a alfabetizar niños y fomentar el hábito de la lectura mediante módulos temáticos basados en emociones." },
      { q: "¿Cómo empiezo a usar la aplicación?", a: "Crea tu cuenta eligiendo un método de registro (Google, teléfono o correo), completa tu información básica y podrás acceder a todos los módulos disponibles." },
      { q: "¿Es gratuita la aplicación?", a: "Sí, la aplicación es completamente gratuita para todos los usuarios registrados." },
      { q: "¿En qué idioma está disponible la app?", a: "Actualmente la aplicación está disponible en español. Próximamente añadiremos más idiomas." },
    ],
  },
  {
    id: "modulos",
    emoji: "📚",
    label: "Módulos",
    items: [
      { q: "¿Qué son los módulos?", a: "Los módulos son unidades de aprendizaje temáticas basadas en emociones (Felicidad, Enojo, Desagrado, Tristeza). Cada módulo incluye PDFs, videos y audiocuentos." },
      { q: "¿Cómo accedo al contenido de un módulo?", a: "Desde la pantalla de inicio o la pantalla de Módulos, toca el módulo que deseas explorar. Verás las pestañas PDF, Video y Audiocuento para acceder a cada tipo de contenido." },
      { q: "¿Puedo descargar el contenido para verlo sin internet?", a: "Actualmente el contenido requiere conexión a internet. La descarga offline estará disponible en futuras versiones." },
      { q: "¿Con qué frecuencia se agregan nuevos módulos?", a: "Añadimos nuevos módulos y contenido de forma periódica. Te notificaremos cuando haya nuevo material disponible." },
    ],
  },
  {
    id: "foro",
    emoji: "💬",
    label: "Foro",
    items: [
      { q: "¿Qué es el Foro?", a: "El Foro es un espacio de comunidad donde maestros, coordinadores y participantes pueden compartir reflexiones, recursos y noticias relacionadas con los módulos." },
      { q: "¿Puedo publicar imágenes o videos en el Foro?", a: "Sí, puedes compartir texto, imágenes y videos en el Foro. Asegúrate de que el contenido sea apropiado y relacionado con el aprendizaje." },
      { q: "¿Cómo se modera el contenido del Foro?", a: "El equipo de Sueños y Letras revisa el contenido del Foro para garantizar un ambiente seguro y positivo para todos." },
    ],
  },
  {
    id: "cuenta",
    emoji: "👤",
    label: "Mi Cuenta",
    items: [
      { q: "¿Cómo cambio mi foto de perfil?", a: "Ve a Mi Perfil desde el botón en la pantalla de inicio. Toca el ícono de cámara sobre tu foto actual y selecciona una nueva imagen de tu galería." },
      { q: "¿Cómo cambio mi contraseña?", a: "En la pantalla de inicio de sesión, toca '¿Olvidaste tu contraseña?' y sigue las instrucciones enviadas a tu correo o número de teléfono." },
      { q: "¿Puedo cambiar mi método de inicio de sesión?", a: "Actualmente el método de inicio de sesión se configura al registrarse. Contáctanos a través del soporte si necesitas cambiarlo." },
      { q: "¿Cómo elimino mi cuenta?", a: "Para eliminar tu cuenta, escríbenos a soporte@suenosyletras.org indicando tu solicitud y la eliminaremos en un plazo de 5 días hábiles." },
    ],
  },
];

export function FAQScreen() {
  const navigate = useNavigate();
  const [openItem, setOpenItem] = useState<string | null>(null);

  function toggle(key: string) {
    setOpenItem(prev => prev === key ? null : key);
  }

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
            <h1 className="text-white" style={{ fontSize: "1.15rem", fontWeight: 800 }}>Preguntas Frecuentes</h1>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {CATEGORIES.map(cat => (
          <section key={cat.id}>
            {/* category header */}
            <div className="flex items-center gap-2 mb-2.5">
              <span style={{ fontSize: "1.1rem" }}>{cat.emoji}</span>
              <p style={{ fontSize: "0.82rem", fontWeight: 800, color: TEXT_DARK }}>{cat.label}</p>
              <div className="flex-1 h-px ml-1" style={{ background: "#E0F0EF" }} />
            </div>

            {/* accordion items */}
            <div className="space-y-2">
              {cat.items.map((item, idx) => {
                const key    = `${cat.id}-${idx}`;
                const isOpen = openItem === key;
                return (
                  <div
                    key={key}
                    className="rounded-xl overflow-hidden bg-white transition-shadow"
                    style={{ border: `1.5px solid ${isOpen ? BRAND : "#E0F0EF"}` }}
                  >
                    <button
                      onClick={() => toggle(key)}
                      className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left"
                    >
                      <span style={{ fontSize: "0.8rem", fontWeight: isOpen ? 700 : 500, color: isOpen ? BRAND : TEXT_DARK, flex: 1, lineHeight: 1.4 }}>
                        {item.q}
                      </span>
                      <ChevronDown
                        size={16}
                        color={isOpen ? BRAND : TEXT_MUTED}
                        style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", shrink: 0, marginTop: "1px" }}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4" style={{ borderTop: "1px solid #E0F0EF" }}>
                        <p style={{ fontSize: "0.78rem", color: TEXT_MED, lineHeight: 1.6, marginTop: "10px" }}>
                          {item.a}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Contact card */}
        <div
          className="rounded-2xl p-4 text-center mt-2"
          style={{ background: "#E8F8F7", border: "1px solid #C0E8E5" }}
        >
          <p style={{ fontSize: "0.8rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "4px" }}>
            ¿No encontraste tu respuesta?
          </p>
          <p style={{ fontSize: "0.72rem", color: TEXT_MED }}>
            Escríbenos a{" "}
            <span style={{ color: BRAND, fontWeight: 700 }}>soporte@suenosyletras.org</span>
          </p>
        </div>

        <div className="h-2" />
      </div>

      {/* ── Bottom Nav ──────────────────────────────────────────── */}
      <BottomNav
        left={{ icon: <Home size={22} color={BRAND} />, label: "Inicio",    onClick: () => navigate("/") }}
        right={{ icon: <User size={22} color={BRAND} />, label: "Mi Perfil", onClick: () => navigate("/profile") }}
      />
    </div>
  );
}

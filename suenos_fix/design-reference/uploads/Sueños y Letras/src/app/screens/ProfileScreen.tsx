import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Camera, User, Mail, Phone, MapPin, LogOut, CheckCircle2, Home, HelpCircle } from "lucide-react";
import { BottomNav } from "../components/BottomNav";

const BRAND      = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const TEXT_DARK  = "#1A3A38";
const TEXT_MED   = "#4A6E6B";
const TEXT_MUTED = "#717182";

const SCHOOLS = [
  "Colegio Americano",
  "Escuela Nacional Primaria",
  "Colegio La Salle",
  "Instituto Bilingüe",
  "Escuela Pública Central",
  "Colegio San Francisco",
  "Otro",
];

export function ProfileScreen() {
  const navigate = useNavigate();

  const [photo,      setPhoto]    = useState<string | null>(null);
  const [name,       setName]     = useState("María Reneé");
  const [lastname,   setLastname] = useState("García López");
  const [email,      setEmail]    = useState("maria@ejemplo.com");
  const [phone,      setPhone]    = useState("+502 1234 5678");
  const [school,     setSchool]   = useState("Colegio Americano");
  const [saved,      setSaved]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhoto(url);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const initials = `${name.charAt(0)}${lastname.charAt(0)}`.toUpperCase();

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="px-5 pt-10 pb-10 relative overflow-hidden shrink-0"
        style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 bg-white" />
        <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full opacity-10 bg-white" />
        <p className="relative text-white/80 mb-4" style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Mi Perfil
        </p>

        {/* avatar */}
        <div className="relative flex justify-center">
          <div className="relative">
            {photo ? (
              <img src={photo} alt="Foto de perfil" className="w-24 h-24 rounded-full object-cover" style={{ border: "3px solid white" }} />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.25)", border: "3px solid white" }}
              >
                <span style={{ fontSize: "2rem", fontWeight: 800, color: "white" }}>{initials}</span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
              style={{ background: "white" }}
            >
              <Camera size={15} color={BRAND} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
        </div>

        <p className="relative text-white text-center mt-3" style={{ fontSize: "1rem", fontWeight: 800 }}>
          {name} {lastname}
        </p>
        <p className="relative text-white/70 text-center" style={{ fontSize: "0.75rem" }}>{email}</p>
      </header>

      {/* ── Form ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {saved && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: "#F0FFF8", border: "1px solid #C6F6D5" }}>
            <CheckCircle2 size={16} color="#38A169" />
            <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "#276749" }}>
              Perfil actualizado correctamente
            </p>
          </div>
        )}

        <SectionLabel label="Información personal" />

        <EditField
          label="Nombre"
          value={name}
          onChange={setName}
          icon={<User size={15} color={TEXT_MUTED} />}
          placeholder="Tu nombre"
        />
        <EditField
          label="Apellido"
          value={lastname}
          onChange={setLastname}
          icon={<User size={15} color={TEXT_MUTED} />}
          placeholder="Tu apellido"
        />

        <SectionLabel label="Contacto" />

        <EditField
          label="Correo electrónico"
          value={email}
          onChange={setEmail}
          icon={<Mail size={15} color={TEXT_MUTED} />}
          placeholder="correo@ejemplo.com"
          type="email"
        />
        <EditField
          label="Teléfono"
          value={phone}
          onChange={setPhone}
          icon={<Phone size={15} color={TEXT_MUTED} />}
          placeholder="+502 1234 5678"
          type="tel"
        />

        <SectionLabel label="Institución" />

        <div>
          <p style={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "6px" }}>
            Colegio / Ubicación
          </p>
          <div className="relative">
            <MapPin size={15} color={TEXT_MUTED} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={school}
              onChange={e => setSchool(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-xl appearance-none outline-none"
              style={{
                border:     `1.5px solid ${BRAND}`,
                background: "white",
                fontSize:   "0.82rem",
                color:      TEXT_DARK,
              }}
            >
              {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* save */}
        <button
          onClick={handleSave}
          className="w-full py-3.5 rounded-xl text-white mt-2 transition-all active:scale-[0.98]"
          style={{ background: `linear-gradient(90deg,${BRAND},${BRAND_DARK})`, fontSize: "0.88rem", fontWeight: 700 }}
        >
          Guardar cambios
        </button>

        {/* sign out */}
        <button
          onClick={() => navigate("/login")}
          className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ border: "1.5px solid #FEB2B2", color: "#C53030", background: "#FFF5F5", fontSize: "0.85rem", fontWeight: 700 }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>

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

/* ── Helpers ──────────────────────────────────────────────────────── */

function SectionLabel({ label }: { label: string }) {
  return (
    <p style={{ fontSize: "0.68rem", fontWeight: 700, color: BRAND, textTransform: "uppercase", letterSpacing: "0.07em", paddingTop: "4px" }}>
      {label}
    </p>
  );
}

function EditField({ label, value, onChange, icon, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  icon?: React.ReactNode; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <p style={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "6px" }}>{label}</p>
      <div className="relative flex items-center">
        {icon && <span className="absolute left-3.5 pointer-events-none">{icon}</span>}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className="w-full py-3 rounded-xl outline-none transition-colors"
          style={{
            paddingLeft:  icon ? "2.5rem" : "1rem",
            paddingRight: "1rem",
            border:      `1.5px solid ${value ? BRAND : "#D0ECEB"}`,
            background:  "white",
            fontSize:    "0.82rem",
            color:       TEXT_DARK,
          }}
        />
      </div>
    </div>
  );
}

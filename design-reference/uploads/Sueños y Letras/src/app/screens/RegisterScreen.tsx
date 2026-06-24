import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Mail, Phone, Eye, EyeOff, ChevronRight, MapPin, User, CheckCircle2 } from "lucide-react";
import logoImg from "figma:asset/309521523_406445261650683_3586315977316360400_n.jpg";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const BRAND      = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const TEXT_DARK  = "#1A3A38";
const TEXT_MED   = "#4A6E6B";
const TEXT_MUTED = "#717182";

type Method    = "google" | "phone" | "email" | null;
type PhoneStep = "number" | "otp";
type Step      = 0 | 1 | 2;

const SCHOOLS = [
  "Colegio Americano",
  "Escuela Nacional Primaria",
  "Colegio La Salle",
  "Instituto Bilingüe",
  "Escuela Pública Central",
  "Colegio San Francisco",
  "Otro",
];

export function RegisterScreen() {
  const navigate = useNavigate();

  const [step,       setStep]       = useState<Step>(0);
  const [method,     setMethod]     = useState<Method>(null);
  const [phoneStep,  setPhoneStep]  = useState<PhoneStep>("number");
  const [showPass,   setShowPass]   = useState(false);
  const [showPass2,  setShowPass2]  = useState(false);

  /* form fields */
  const [phone,    setPhone]    = useState("");
  const [otp,      setOtp]      = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [name,     setName]     = useState("");
  const [lastname, setLastname] = useState("");
  const [school,   setSchool]   = useState("");

  function chooseMethod(m: Method) {
    setMethod(m);
    if (m === "google") { setStep(2); }  /* google skips auth form */
    else                { setStep(1); }
  }

  function advanceToInfo() { setStep(2); }

  function handleRegister() { navigate("/"); }

  return (
    <div className="flex flex-col min-h-screen bg-[#F5FEFE]">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center px-5 pt-10 pb-4">
        <button
          onClick={() => { if (step === 0) navigate("/login"); else if (step === 1) { setStep(0); setMethod(null); } else setStep(1); }}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors active:bg-[#E0F5F3]"
          style={{ border: "1.5px solid #D0ECEB" }}
        >
          <ArrowLeft size={18} color={TEXT_MED} />
        </button>
        <div className="flex-1" />
        <StepDots current={step} total={3} />
      </div>

      {/* ── Logo ───────────────────────────────────────────────── */}
      <div className="flex flex-col items-center px-6 mb-6">
        <div className="bg-white rounded-2xl p-2 shadow-sm mb-3" style={{ border: "1px solid #E0F5F3" }}>
          <ImageWithFallback src={logoImg} alt="Sueños y Letras" className="w-14 h-14 rounded-xl object-cover" />
        </div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: TEXT_DARK, textAlign: "center" }}>
          {step === 0 && "Crear cuenta"}
          {step === 1 && "Verificar identidad"}
          {step === 2 && "Tu información"}
        </h1>
        <p style={{ fontSize: "0.78rem", color: TEXT_MUTED, textAlign: "center", marginTop: "4px" }}>
          {step === 0 && "Elige cómo quieres registrarte"}
          {step === 1 && method === "email" && "Ingresa tu correo y contraseña"}
          {step === 1 && method === "phone" && (phoneStep === "number" ? "Ingresa tu número de teléfono" : "Ingresa el código que recibiste")}
          {step === 2 && "Cuéntanos un poco sobre ti"}
        </p>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="flex-1 px-5 space-y-3 overflow-y-auto">

        {/* ── Step 0: method selection ── */}
        {step === 0 && (
          <>
            <MethodCard
              icon={<GoogleIcon />}
              label="Continuar con Google"
              sub="Usa tu cuenta de Google"
              onClick={() => chooseMethod("google")}
            />
            <MethodCard
              icon={<Phone size={22} color="#7C3AED" />}
              label="Número de teléfono"
              sub="Recibirás un código de verificación"
              onClick={() => chooseMethod("phone")}
              iconBg="#F5F0FF"
            />
            <MethodCard
              icon={<Mail size={22} color={BRAND} />}
              label="Correo y contraseña"
              sub="Crea tu cuenta con email"
              onClick={() => chooseMethod("email")}
              iconBg="#E8F8F7"
            />
          </>
        )}

        {/* ── Step 1: email form ── */}
        {step === 1 && method === "email" && (
          <>
            <Field label="Correo electrónico" placeholder="correo@ejemplo.com" value={email} onChange={setEmail} type="email" />
            <Field
              label="Contraseña" placeholder="Mínimo 8 caracteres" value={password} onChange={setPassword}
              type={showPass ? "text" : "password"}
              right={<EyeToggle show={showPass} toggle={() => setShowPass(p => !p)} />}
            />
            <Field
              label="Confirmar contraseña" placeholder="Repite tu contraseña" value={confirm} onChange={setConfirm}
              type={showPass2 ? "text" : "password"}
              right={<EyeToggle show={showPass2} toggle={() => setShowPass2(p => !p)} />}
            />
            <PrimaryBtn label="Siguiente" onClick={advanceToInfo} disabled={!email || !password || password !== confirm} />
          </>
        )}

        {/* ── Step 1: phone form ── */}
        {step === 1 && method === "phone" && (
          <>
            {phoneStep === "number" && (
              <>
                <Field label="Número de teléfono" placeholder="+502 1234 5678" value={phone} onChange={setPhone} type="tel" icon={<Phone size={16} color={TEXT_MUTED} />} />
                <PrimaryBtn
                  label="Enviar código"
                  onClick={() => setPhoneStep("otp")}
                  disabled={phone.length < 8}
                />
              </>
            )}
            {phoneStep === "otp" && (
              <>
                <div className="rounded-2xl p-4 text-center" style={{ background: "#E8F8F7", border: "1px solid #C0E8E5" }}>
                  <p style={{ fontSize: "0.78rem", color: TEXT_MED }}>Código enviado a</p>
                  <p style={{ fontSize: "0.88rem", fontWeight: 700, color: TEXT_DARK }}>{phone}</p>
                </div>
                <OtpInput value={otp} onChange={setOtp} />
                <PrimaryBtn label="Verificar código" onClick={advanceToInfo} disabled={otp.length < 6} />
                <button
                  onClick={() => setPhoneStep("number")}
                  className="w-full text-center py-2"
                  style={{ fontSize: "0.78rem", color: TEXT_MUTED }}
                >
                  ¿No recibiste el código? <span style={{ color: BRAND, fontWeight: 700 }}>Reenviar</span>
                </button>
              </>
            )}
          </>
        )}

        {/* ── Step 2: basic info ── */}
        {step === 2 && (
          <>
            {method === "google" && (
              <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: "#F0FFF4", border: "1px solid #C6F6D5" }}>
                <CheckCircle2 size={18} color="#38A169" />
                <p style={{ fontSize: "0.78rem", color: "#276749", fontWeight: 600 }}>
                  Google conectado correctamente
                </p>
              </div>
            )}
            <Field label="Nombre" placeholder="María" value={name} onChange={setName} icon={<User size={16} color={TEXT_MUTED} />} />
            <Field label="Apellido" placeholder="García" value={lastname} onChange={setLastname} icon={<User size={16} color={TEXT_MUTED} />} />

            <div>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "6px" }}>
                Colegio / Ubicación
              </p>
              <div className="relative">
                <MapPin size={16} color={TEXT_MUTED} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={school}
                  onChange={e => setSchool(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-xl appearance-none"
                  style={{
                    border:      `1.5px solid ${school ? BRAND : "#D0ECEB"}`,
                    background:  "white",
                    fontSize:    "0.82rem",
                    color:       school ? TEXT_DARK : TEXT_MUTED,
                    outline:     "none",
                  }}
                >
                  <option value="" disabled>Selecciona tu colegio</option>
                  {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <PrimaryBtn label="Crear cuenta" onClick={handleRegister} disabled={!name || !lastname || !school} />
          </>
        )}

      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="px-5 py-6 text-center">
        <p style={{ fontSize: "0.78rem", color: TEXT_MUTED }}>
          ¿Ya tienes cuenta?{" "}
          <button onClick={() => navigate("/login")} style={{ color: BRAND, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all"
          style={{ width: i === current ? "16px" : "6px", height: "6px", background: i <= current ? BRAND : "#D0ECEB" }}
        />
      ))}
    </div>
  );
}

function MethodCard({ icon, label, sub, onClick, iconBg }: {
  icon: React.ReactNode; label: string; sub: string; onClick: () => void; iconBg?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white text-left transition-all active:scale-[0.98] hover:shadow-sm"
      style={{ border: "1.5px solid #E0F0EF" }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg ?? "#FFF3E0" }}>
        {icon}
      </div>
      <div className="flex-1">
        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: TEXT_DARK }}>{label}</p>
        <p style={{ fontSize: "0.7rem", color: TEXT_MUTED }}>{sub}</p>
      </div>
      <ChevronRight size={16} color={TEXT_MUTED} />
    </button>
  );
}

function Field({
  label, placeholder, value, onChange, type = "text", icon, right,
}: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  type?: string; icon?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div>
      <p style={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "6px" }}>{label}</p>
      <div className="relative flex items-center">
        {icon && <span className="absolute left-3.5 pointer-events-none">{icon}</span>}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full py-3 rounded-xl outline-none transition-colors"
          style={{
            paddingLeft:  icon  ? "2.5rem" : "1rem",
            paddingRight: right ? "2.8rem" : "1rem",
            border: `1.5px solid ${value ? BRAND : "#D0ECEB"}`,
            background: "white",
            fontSize: "0.82rem",
            color: TEXT_DARK,
          }}
        />
        {right && <span className="absolute right-3">{right}</span>}
      </div>
    </div>
  );
}

function EyeToggle({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} style={{ color: TEXT_MUTED }}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p style={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "8px" }}>Código de 6 dígitos</p>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={6}
        placeholder="• • • • • •"
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full py-4 rounded-xl outline-none text-center tracking-[1rem]"
        style={{
          border:     `1.5px solid ${value.length > 0 ? BRAND : "#D0ECEB"}`,
          background: "white",
          fontSize:   "1.4rem",
          fontWeight: 800,
          color:      TEXT_DARK,
          letterSpacing: "0.8rem",
        }}
      />
    </div>
  );
}

function PrimaryBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3.5 rounded-xl text-white transition-all active:scale-[0.98]"
      style={{
        background: disabled ? "#B0D8D6" : `linear-gradient(90deg,${BRAND},${BRAND_DARK})`,
        fontSize:   "0.88rem",
        fontWeight: 700,
        cursor:     disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

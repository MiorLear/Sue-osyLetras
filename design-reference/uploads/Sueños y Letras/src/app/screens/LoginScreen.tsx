import { useState } from "react";
import { useNavigate } from "react-router";
import { Mail, Phone, Eye, EyeOff, ArrowLeft } from "lucide-react";
import logoImg from "figma:asset/309521523_406445261650683_3586315977316360400_n.jpg";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const BRAND      = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const TEXT_DARK  = "#1A3A38";
const TEXT_MUTED = "#717182";
const TEXT_MED   = "#4A6E6B";

type View = "main" | "phone-number" | "phone-otp";

export function LoginScreen() {
  const navigate = useNavigate();

  const [view,     setView]     = useState<View>("main");
  const [showPass, setShowPass] = useState(false);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [phone,    setPhone]    = useState("");
  const [otp,      setOtp]      = useState("");

  function handleLogin() { navigate("/"); }

  return (
    <div className="flex flex-col min-h-screen bg-[#F5FEFE]">

      {/* ── Back (only on sub-views) ────────────────────────────── */}
      {view !== "main" && (
        <div className="px-5 pt-10 pb-2">
          <button
            onClick={() => setView("main")}
            className="flex items-center gap-1.5 transition-opacity active:opacity-60"
            style={{ color: TEXT_MED, fontSize: "0.8rem", fontWeight: 600 }}
          >
            <ArrowLeft size={18} /> Volver
          </button>
        </div>
      )}

      {/* ── Logo ───────────────────────────────────────────────── */}
      <div className={`flex flex-col items-center px-6 ${view !== "main" ? "pt-4" : "pt-12"} mb-6`}>
        <div className="bg-white rounded-2xl p-2 shadow-sm mb-3" style={{ border: "1px solid #E0F5F3" }}>
          <ImageWithFallback src={logoImg} alt="Sueños y Letras" className="w-14 h-14 rounded-xl object-cover" />
        </div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: TEXT_DARK, textAlign: "center" }}>
          {view === "main"         && "Bienvenida de nuevo"}
          {view === "phone-number" && "Ingresa tu teléfono"}
          {view === "phone-otp"    && "Verificar número"}
        </h1>
        <p style={{ fontSize: "0.78rem", color: TEXT_MUTED, textAlign: "center", marginTop: "4px" }}>
          {view === "main"         && "Sueños y Letras · más letras, más libres"}
          {view === "phone-number" && "Te enviaremos un código de 6 dígitos"}
          {view === "phone-otp"    && `Código enviado a ${phone}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-3">

        {/* ── Main view ─────────────────────────────────────────── */}
        {view === "main" && (
          <>
            {/* Google */}
            <SocialBtn onClick={handleLogin}>
              <GoogleIcon />
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: TEXT_DARK }}>Continuar con Google</span>
            </SocialBtn>

            {/* Phone */}
            <SocialBtn onClick={() => setView("phone-number")}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#7C3AED" }}>
                <Phone size={13} color="white" />
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: TEXT_DARK }}>Continuar con teléfono</span>
            </SocialBtn>

            {/* divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px" style={{ background: "#D0ECEB" }} />
              <span style={{ fontSize: "0.72rem", color: TEXT_MUTED }}>o con correo</span>
              <div className="flex-1 h-px" style={{ background: "#D0ECEB" }} />
            </div>

            {/* Email */}
            <AuthField
              label="Correo electrónico"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={setEmail}
              type="email"
              icon={<Mail size={15} color={TEXT_MUTED} />}
            />
            <div>
              <AuthField
                label="Contraseña"
                placeholder="Tu contraseña"
                value={password}
                onChange={setPassword}
                type={showPass ? "text" : "password"}
                icon={<EyeBtn show={showPass} toggle={() => setShowPass(p => !p)} />}
                iconRight
              />
              <div className="flex justify-end mt-1.5">
                <button
                  onClick={() => navigate("/forgot-password")}
                  style={{ fontSize: "0.72rem", color: BRAND, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            <PrimaryBtn
              label="Iniciar sesión"
              onClick={handleLogin}
              disabled={!email || !password}
            />
          </>
        )}

        {/* ── Phone number view ─────────────────────────────────── */}
        {view === "phone-number" && (
          <>
            <AuthField
              label="Número de teléfono"
              placeholder="+502 1234 5678"
              value={phone}
              onChange={setPhone}
              type="tel"
              icon={<Phone size={15} color={TEXT_MUTED} />}
            />
            <PrimaryBtn
              label="Enviar código"
              onClick={() => setView("phone-otp")}
              disabled={phone.length < 8}
            />
          </>
        )}

        {/* ── OTP view ──────────────────────────────────────────── */}
        {view === "phone-otp" && (
          <>
            <div className="rounded-2xl p-4 text-center" style={{ background: "#E8F8F7", border: "1px solid #C0E8E5" }}>
              <p style={{ fontSize: "0.78rem", color: TEXT_MED }}>Código enviado a</p>
              <p style={{ fontSize: "0.88rem", fontWeight: 700, color: TEXT_DARK }}>{phone}</p>
            </div>

            <div>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "8px" }}>
                Código de 6 dígitos
              </p>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • • • •"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full py-4 rounded-xl outline-none text-center"
                style={{
                  border:        `1.5px solid ${otp.length > 0 ? BRAND : "#D0ECEB"}`,
                  background:    "white",
                  fontSize:      "1.6rem",
                  fontWeight:    800,
                  color:         TEXT_DARK,
                  letterSpacing: "0.8rem",
                }}
              />
            </div>

            <PrimaryBtn label="Verificar e iniciar sesión" onClick={handleLogin} disabled={otp.length < 6} />

            <button
              onClick={() => setView("phone-number")}
              className="w-full text-center py-2"
              style={{ fontSize: "0.78rem", color: TEXT_MUTED, background: "none", border: "none", cursor: "pointer" }}
            >
              ¿No recibiste el código?{" "}
              <span style={{ color: BRAND, fontWeight: 700 }}>Reenviar</span>
            </button>
          </>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      {view === "main" && (
        <div className="px-5 py-6 text-center">
          <p style={{ fontSize: "0.78rem", color: TEXT_MUTED }}>
            ¿No tienes cuenta?{" "}
            <button
              onClick={() => navigate("/register")}
              style={{ color: BRAND, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}
            >
              Registrarse
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Shared sub-components ──────────────────────────────────────────── */

function SocialBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white transition-all active:scale-[0.98] hover:shadow-sm"
      style={{ border: "1.5px solid #E0F0EF" }}
    >
      {children}
    </button>
  );
}

function AuthField({ label, placeholder, value, onChange, type = "text", icon, iconRight }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  type?: string; icon?: React.ReactNode; iconRight?: boolean;
}) {
  return (
    <div>
      <p style={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "6px" }}>{label}</p>
      <div className="relative flex items-center">
        {!iconRight && icon && (
          <span className="absolute left-3.5 pointer-events-none">{icon}</span>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full py-3 rounded-xl outline-none transition-colors"
          style={{
            paddingLeft:  iconRight ? "1rem"    : "2.5rem",
            paddingRight: iconRight ? "2.8rem"  : "1rem",
            border:      `1.5px solid ${value ? BRAND : "#D0ECEB"}`,
            background:  "white",
            fontSize:    "0.82rem",
            color:       TEXT_DARK,
          }}
        />
        {iconRight && icon && (
          <span className="absolute right-3">{icon}</span>
        )}
      </div>
    </div>
  );
}

function EyeBtn({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} style={{ color: TEXT_MUTED }}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
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
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

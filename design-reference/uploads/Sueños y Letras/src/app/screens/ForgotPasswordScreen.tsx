import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Mail, Phone, CheckCircle2 } from "lucide-react";
import logoImg from "figma:asset/309521523_406445261650683_3586315977316360400_n.jpg";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const BRAND      = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const TEXT_DARK  = "#1A3A38";
const TEXT_MED   = "#4A6E6B";
const TEXT_MUTED = "#717182";

type Tab       = "email" | "phone";
type PhoneStep = "number" | "otp" | "success";

export function ForgotPasswordScreen() {
  const navigate = useNavigate();

  const [tab,        setTab]       = useState<Tab>("email");
  const [email,      setEmail]     = useState("");
  const [emailSent,  setEmailSent] = useState(false);
  const [phone,      setPhone]     = useState("");
  const [otp,        setOtp]       = useState("");
  const [phoneStep,  setPhoneStep] = useState<PhoneStep>("number");

  return (
    <div className="flex flex-col min-h-screen bg-[#F5FEFE]">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center px-5 pt-10 pb-4">
        <button
          onClick={() => navigate("/login")}
          className="flex items-center gap-1.5 transition-opacity active:opacity-60"
          style={{ color: TEXT_MED, fontSize: "0.8rem", fontWeight: 600 }}
        >
          <ArrowLeft size={18} />
          Volver al inicio de sesión
        </button>
      </div>

      {/* ── Logo + title ────────────────────────────────────────── */}
      <div className="flex flex-col items-center px-6 pt-2 mb-6">
        <div className="bg-white rounded-2xl p-2 shadow-sm mb-3" style={{ border: "1px solid #E0F5F3" }}>
          <ImageWithFallback src={logoImg} alt="Sueños y Letras" className="w-12 h-12 rounded-xl object-cover" />
        </div>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: TEXT_DARK, textAlign: "center" }}>
          Recuperar contraseña
        </h1>
        <p style={{ fontSize: "0.78rem", color: TEXT_MUTED, textAlign: "center", marginTop: "4px" }}>
          Te ayudamos a recuperar el acceso a tu cuenta
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5">

        {/* ── Tab selector ─────────────────────────────────────── */}
        {!emailSent && phoneStep !== "success" && (
          <div
            className="flex p-1 rounded-2xl mb-5"
            style={{ background: "#E8F8F7" }}
          >
            {(["email", "phone"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all"
                style={{
                  background: tab === t ? "white" : "transparent",
                  boxShadow:  tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  color:      tab === t ? TEXT_DARK : TEXT_MUTED,
                  fontSize:   "0.8rem",
                  fontWeight: tab === t ? 700 : 500,
                }}
              >
                {t === "email"
                  ? <><Mail size={14} /> Por correo</>
                  : <><Phone size={14} /> Por teléfono</>
                }
              </button>
            ))}
          </div>
        )}

        {/* ── Email flow ────────────────────────────────────────── */}
        {tab === "email" && (
          emailSent ? (
            <SuccessCard
              icon="📬"
              title="¡Correo enviado!"
              message={`Revisa tu bandeja de entrada en ${email}. Te enviamos un enlace para restablecer tu contraseña.`}
              actionLabel="Volver al inicio de sesión"
              onAction={() => navigate("/login")}
            />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={{ background: "#F0FFFE", border: "1px solid #C0E8E5" }}>
                <p style={{ fontSize: "0.78rem", color: TEXT_MED, lineHeight: 1.5 }}>
                  Ingresa el correo electrónico con el que te registraste y te enviaremos un enlace para restablecer tu contraseña.
                </p>
              </div>

              <Field
                label="Correo electrónico"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={setEmail}
                type="email"
                icon={<Mail size={15} color={TEXT_MUTED} />}
              />

              <PrimaryBtn
                label="Enviar enlace de recuperación"
                onClick={() => setEmailSent(true)}
                disabled={!email.includes("@")}
              />
            </div>
          )
        )}

        {/* ── Phone flow ────────────────────────────────────────── */}
        {tab === "phone" && (
          <div className="space-y-4">
            {phoneStep === "number" && (
              <>
                <div className="rounded-2xl p-4" style={{ background: "#F0FFFE", border: "1px solid #C0E8E5" }}>
                  <p style={{ fontSize: "0.78rem", color: TEXT_MED, lineHeight: 1.5 }}>
                    Ingresa tu número de teléfono y te enviaremos un código de 6 dígitos para verificar tu identidad.
                  </p>
                </div>
                <Field
                  label="Número de teléfono"
                  placeholder="+502 1234 5678"
                  value={phone}
                  onChange={setPhone}
                  type="tel"
                  icon={<Phone size={15} color={TEXT_MUTED} />}
                />
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

                <PrimaryBtn
                  label="Verificar código"
                  onClick={() => setPhoneStep("success")}
                  disabled={otp.length < 6}
                />
                <button
                  onClick={() => setPhoneStep("number")}
                  className="w-full text-center py-2"
                  style={{ fontSize: "0.78rem", color: TEXT_MUTED, background: "none", border: "none", cursor: "pointer" }}
                >
                  ¿No recibiste el código?{" "}
                  <span style={{ color: BRAND, fontWeight: 700 }}>Reenviar</span>
                </button>
              </>
            )}

            {phoneStep === "success" && (
              <SuccessCard
                icon="✅"
                title="¡Identidad verificada!"
                message="Puedes ingresar una nueva contraseña para tu cuenta."
                actionLabel="Volver al inicio de sesión"
                onAction={() => navigate("/login")}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function Field({ label, placeholder, value, onChange, type = "text", icon }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  type?: string; icon?: React.ReactNode;
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
          className="w-full py-3 rounded-xl outline-none"
          style={{
            paddingLeft:  "2.5rem",
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

function SuccessCard({ icon, title, message, actionLabel, onAction }: {
  icon: string; title: string; message: string; actionLabel: string; onAction: () => void;
}) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-6 flex flex-col items-center text-center"
        style={{ background: "#F0FFF8", border: "1.5px solid #C6F6D5" }}
      >
        <span style={{ fontSize: "3rem", marginBottom: "12px" }}>{icon}</span>
        <h2 style={{ fontSize: "1rem", fontWeight: 800, color: TEXT_DARK, marginBottom: "8px" }}>{title}</h2>
        <p style={{ fontSize: "0.8rem", color: TEXT_MED, lineHeight: 1.55 }}>{message}</p>
      </div>
      <button
        onClick={onAction}
        className="w-full py-3.5 rounded-xl text-white transition-all active:scale-[0.98]"
        style={{ background: `linear-gradient(90deg,${BRAND},${BRAND_DARK})`, fontSize: "0.88rem", fontWeight: 700 }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

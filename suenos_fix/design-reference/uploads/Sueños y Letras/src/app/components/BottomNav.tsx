import { useNavigate } from "react-router";

const BRAND = "#3DBFB8";
const BRAND_LIGHT = "#E6F8F7";
const TEXT_DARK = "#1A3A38";

interface NavBtn {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

interface BottomNavProps {
  left: NavBtn;
  right: NavBtn;
}

export function BottomNav({ left, right }: BottomNavProps) {
  return (
    <div
      className="px-4 pb-7 pt-3 flex gap-3 bg-white shrink-0"
      style={{ borderTop: "1px solid #E4F4F3" }}
    >
      <NavButton {...left} />
      <NavButton {...right} />
    </div>
  );
}

function NavButton({ icon, label, onClick }: NavBtn) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all active:scale-95"
      style={{ background: BRAND_LIGHT, border: `1.5px solid ${BRAND}20` }}
    >
      {icon}
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          color: TEXT_DARK,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </button>
  );
}

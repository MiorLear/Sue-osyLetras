export function Logo({ size = 44, radius = 12 }: { size?: number; radius?: number }) {
  return (
    <span className="logo-chip" style={{ borderRadius: radius + 4, padding: size > 50 ? 8 : 6 }}>
      <img src="/logo.jpg" width={size} height={size} style={{ borderRadius: radius }} alt="Sueños y Letras" />
    </span>
  );
}

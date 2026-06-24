import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** override the gradient (used by the emotion detail header) */
  background?: string;
  style?: CSSProperties;
}

export function GradientHeader({ children, background, style }: Props) {
  return (
    <header className="gradient-header" style={{ background, ...style }}>
      {children}
    </header>
  );
}

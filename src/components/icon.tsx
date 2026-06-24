import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

// Conjunto de íconos (estilo Lucide) usados en los mockups, reimplementados con react-native-svg.
export type IconName =
  | 'arrow-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'user'
  | 'mail'
  | 'phone'
  | 'eye'
  | 'eye-off'
  | 'map-pin'
  | 'home'
  | 'help-circle'
  | 'book-open'
  | 'calendar'
  | 'clock'
  | 'message-circle'
  | 'message-square'
  | 'repeat'
  | 'heart'
  | 'file-text'
  | 'video'
  | 'mic'
  | 'play'
  | 'pause'
  | 'plus'
  | 'x'
  | 'send'
  | 'bell'
  | 'edit'
  | 'trash'
  | 'log-out'
  | 'camera'
  | 'maximize'
  | 'check'
  | 'check-circle'
  | 'bookmark'
  | 'image'
  | 'volume'
  | 'compass'
  | 'download';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Para íconos sólidos (play, pause, heart) */
  fill?: string;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 22,
  color = '#1A3A38',
  fill = 'none',
  strokeWidth = 2,
}: IconProps) {
  const stroke = color;
  const common = {
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  let body: React.ReactNode = null;
  switch (name) {
    case 'arrow-left':
      body = (
        <>
          <Path d="m12 19-7-7 7-7" {...common} />
          <Path d="M19 12H5" {...common} />
        </>
      );
      break;
    case 'chevron-right':
      body = <Path d="m9 18 6-6-6-6" {...common} />;
      break;
    case 'chevron-down':
      body = <Path d="m6 9 6 6 6-6" {...common} />;
      break;
    case 'user':
      body = (
        <>
          <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" {...common} />
          <Circle cx={12} cy={7} r={4} {...common} />
        </>
      );
      break;
    case 'mail':
      body = (
        <>
          <Rect x={2} y={4} width={20} height={16} rx={2} {...common} />
          <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" {...common} />
        </>
      );
      break;
    case 'phone':
      body = (
        <Path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
          {...common}
        />
      );
      break;
    case 'eye':
      body = (
        <>
          <Path
            d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
            {...common}
          />
          <Circle cx={12} cy={12} r={3} {...common} />
        </>
      );
      break;
    case 'eye-off':
      body = (
        <>
          <Path
            d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
            {...common}
          />
          <Path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" {...common} />
          <Path
            d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
            {...common}
          />
          <Path d="m2 2 20 20" {...common} />
        </>
      );
      break;
    case 'map-pin':
      body = (
        <>
          <Path
            d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
            {...common}
          />
          <Circle cx={12} cy={10} r={3} {...common} />
        </>
      );
      break;
    case 'home':
      body = (
        <>
          <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...common} />
          <Path d="M9 22V12h6v10" {...common} />
        </>
      );
      break;
    case 'help-circle':
      body = (
        <>
          <Circle cx={12} cy={12} r={10} {...common} />
          <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" {...common} />
          <Path d="M12 17h.01" {...common} />
        </>
      );
      break;
    case 'book-open':
      body = (
        <>
          <Path d="M12 7v14" {...common} />
          <Path
            d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
            {...common}
          />
        </>
      );
      break;
    case 'calendar':
      body = (
        <>
          <Path d="M8 2v4" {...common} />
          <Path d="M16 2v4" {...common} />
          <Rect x={3} y={4} width={18} height={18} rx={2} {...common} />
          <Path d="M3 10h18" {...common} />
        </>
      );
      break;
    case 'clock':
      body = (
        <>
          <Circle cx={12} cy={12} r={10} {...common} />
          <Polyline points="12 6 12 12 16 14" {...common} />
        </>
      );
      break;
    case 'message-circle':
      body = <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" {...common} />;
      break;
    case 'message-square':
      body = (
        <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...common} />
      );
      break;
    case 'repeat':
      body = (
        <>
          <Path d="m2 9 3-3 3 3" {...common} />
          <Path d="M13 18H7a2 2 0 0 1-2-2V6" {...common} />
          <Path d="m22 15-3 3-3-3" {...common} />
          <Path d="M11 6h6a2 2 0 0 1 2 2v10" {...common} />
        </>
      );
      break;
    case 'heart':
      body = (
        <Path
          d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
          {...common}
          fill={fill}
        />
      );
      break;
    case 'file-text':
      body = (
        <>
          <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" {...common} />
          <Path d="M14 2v4a2 2 0 0 0 2 2h4" {...common} />
          <Path d="M16 13H8" {...common} />
          <Path d="M16 17H8" {...common} />
          <Path d="M10 9H8" {...common} />
        </>
      );
      break;
    case 'video':
      body = (
        <>
          <Path d="m22 8-6 4 6 4V8Z" {...common} />
          <Rect x={2} y={6} width={14} height={12} rx={2} ry={2} {...common} />
        </>
      );
      break;
    case 'mic':
      body = (
        <Path
          d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"
          {...common}
        />
      );
      break;
    case 'play':
      body = <Polygon points="6 3 20 12 6 21 6 3" fill={fill} stroke="none" />;
      break;
    case 'pause':
      body = (
        <>
          <Rect x={14} y={4} width={4} height={16} rx={1} fill={fill} stroke="none" />
          <Rect x={6} y={4} width={4} height={16} rx={1} fill={fill} stroke="none" />
        </>
      );
      break;
    case 'plus':
      body = (
        <>
          <Path d="M12 5v14" {...common} />
          <Path d="M5 12h14" {...common} />
        </>
      );
      break;
    case 'x':
      body = (
        <>
          <Path d="M18 6 6 18" {...common} />
          <Path d="m6 6 12 12" {...common} />
        </>
      );
      break;
    case 'send':
      body = (
        <>
          <Path
            d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"
            {...common}
          />
          <Path d="m21.854 2.147-10.94 10.939" {...common} />
        </>
      );
      break;
    case 'bell':
      body = (
        <>
          <Path d="M10.268 21a2 2 0 0 0 3.464 0" {...common} />
          <Path
            d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
            {...common}
          />
        </>
      );
      break;
    case 'edit':
      body = (
        <>
          <Path d="M12 20h9" {...common} />
          <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" {...common} />
        </>
      );
      break;
    case 'trash':
      body = (
        <>
          <Path d="M3 6h18" {...common} />
          <Path
            d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            {...common}
          />
        </>
      );
      break;
    case 'log-out':
      body = (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...common} />
          <Polyline points="16 17 21 12 16 7" {...common} />
          <Line x1={21} y1={12} x2={9} y2={12} {...common} />
        </>
      );
      break;
    case 'camera':
      body = (
        <>
          <Path
            d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
            {...common}
          />
          <Circle cx={12} cy={13} r={3} {...common} />
        </>
      );
      break;
    case 'maximize':
      body = (
        <>
          <Polyline points="15 3 21 3 21 9" {...common} />
          <Polyline points="9 21 3 21 3 15" {...common} />
          <Line x1={21} y1={3} x2={14} y2={10} {...common} />
          <Line x1={3} y1={21} x2={10} y2={14} {...common} />
        </>
      );
      break;
    case 'check':
      body = <Polyline points="20 6 9 17 4 12" {...common} />;
      break;
    case 'check-circle':
      body = (
        <>
          <Path d="M21.801 10A10 10 0 1 1 17 3.335" {...common} />
          <Path d="m9 11 3 3L22 4" {...common} />
        </>
      );
      break;
    case 'bookmark':
      body = <Path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" {...common} />;
      break;
    case 'image':
      body = (
        <>
          <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} {...common} />
          <Circle cx={9} cy={9} r={2} {...common} />
          <Path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" {...common} />
        </>
      );
      break;
    case 'volume':
      body = (
        <>
          <Path
            d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"
            {...common}
          />
          <Path d="M16 9a5 5 0 0 1 0 6" {...common} />
          <Path d="M19.364 18.364a9 9 0 0 0 0-12.728" {...common} />
        </>
      );
      break;
    case 'compass':
      body = (
        <>
          <Circle cx={12} cy={12} r={10} {...common} />
          <Polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" {...common} />
        </>
      );
      break;
    case 'download':
      body = (
        <>
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...common} />
          <Polyline points="7 10 12 15 17 10" {...common} />
          <Line x1={12} y1={15} x2={12} y2={3} {...common} />
        </>
      );
      break;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}

// Logo de Google a color (multicolor), tal cual el mockup.
export function GoogleIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

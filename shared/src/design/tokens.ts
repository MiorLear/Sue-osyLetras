// Sistema de diseño de Sueños y Letras — extraído de los mockups originales.
// Single source of truth for both apps; the web app turns these into CSS vars.

export const colors = {
  brand: '#3DBFB8',
  brandDark: '#2A9A95',
  bg: '#F5FEFE',
  card: '#FFFFFF',
  textDark: '#1A3A38',
  textBody: '#4A6E6B',
  textMuted: '#717182',
  navBg: '#E6F8F7',
  border: '#E4F4F3',
  borderSoft: '#E0F0EF',
  borderInput: '#D0ECEB',
  disabled: '#B0D8D6',
  danger: '#E53E3E',
  success: '#38A169',
  white: '#FFFFFF',
} as const;

/** Brand gradient used in headers and primary buttons (135deg in the design). */
export const brandGradient = ['#3DBFB8', '#2A9A95'] as const;

export const SCHOOLS = [
  'Colegio Americano',
  'Escuela Nacional Primaria',
  'Colegio La Salle',
  'Instituto Bilingüe',
  'Escuela Pública Central',
  'Colegio San Francisco',
  'Otro',
];

/** Colors per calendar event type. */
export const EVENT_COLORS: Record<string, string> = {
  sesión: '#3DBFB8',
  tarea: '#F59E0B',
  recordatorio: '#7C3AED',
  evento: '#3B82F6',
};

/** Emotion tag styling used in the community feed filters/tags. */
export const MODTAG: Record<string, { label: string; color: string; bg: string }> = {
  alegria: { label: 'Alegría', color: '#B7791F', bg: '#FEFCE8' },
  tristeza: { label: 'Tristeza', color: '#2B6CB0', bg: '#EBF8FF' },
  enojo: { label: 'Enojo', color: '#C53030', bg: '#FFF5F5' },
  miedo: { label: 'Miedo', color: '#6B46C1', bg: '#F5F0FF' },
};

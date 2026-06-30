// Sistema de diseño de Sueños y Letras — extraído de los mockups originales.

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
};

// Degradado de marca usado en headers y botones (135deg en el diseño).
export const brandGradient = ['#3DBFB8', '#2A9A95'] as const;

export type ModuleId = 'felicidad' | 'enojo' | 'desagrado' | 'tristeza';

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  emoji: string;
  color: string;
  gradient: readonly [string, string];
  bg: string;
  border: string;
  description: string;
  pdfs: number;
  videos: number;
  audios: number;
}

export const MODULES: ModuleInfo[] = [
  {
    id: 'felicidad',
    name: 'Felicidad',
    emoji: '😊',
    color: '#F0B429',
    gradient: ['#FFE77A', '#F6C90E'],
    bg: '#FFFBEB',
    border: '#FEF08A',
    description:
      'Exploramos la alegría, la sonrisa y los momentos que nos llenan de felicidad. Los niños aprenden palabras y emociones positivas a través de historias inspiradoras.',
    pdfs: 4,
    videos: 3,
    audios: 2,
  },
  {
    id: 'enojo',
    name: 'Enojo',
    emoji: '😠',
    color: '#E53E3E',
    gradient: ['#FCA5A5', '#EF4444'],
    bg: '#FFF5F5',
    border: '#FED7D7',
    description:
      'Aprendemos a reconocer y canalizar la ira de manera saludable. Los niños descubren que el enojo es una emoción natural que podemos manejar con palabras.',
    pdfs: 3,
    videos: 2,
    audios: 3,
  },
  {
    id: 'desagrado',
    name: 'Desagrado',
    emoji: '🤢',
    color: '#38A169',
    gradient: ['#86EFAC', '#22C55E'],
    bg: '#F0FFF4',
    border: '#BBF7D0',
    description:
      'Exploramos la incomodidad y el rechazo con empatía. Los niños aprenden a expresar lo que no les gusta de forma respetuosa y asertiva.',
    pdfs: 3,
    videos: 3,
    audios: 2,
  },
  {
    id: 'tristeza',
    name: 'Tristeza',
    emoji: '😢',
    color: '#4299E1',
    gradient: ['#93C5FD', '#3B82F6'],
    bg: '#EBF8FF',
    border: '#BEE3F8',
    description:
      'Aprendemos que está bien sentirse triste y cómo encontrar consuelo en las palabras y los libros. La lectura como refugio en momentos difíciles.',
    pdfs: 4,
    videos: 2,
    audios: 3,
  },
];

export const moduleById = (id: string): ModuleInfo | undefined =>
  MODULES.find((m) => m.id === id);

// Biblioteca de emociones — recursos para acompañar emociones en el aula.
export interface EmotionInfo {
  id: string; // slug usado en la ruta /emociones/[id]
  name: string;
  emoji: string;
  color: string;
  bg: string;
}

export const EMOTIONS: EmotionInfo[] = [
  { id: 'alegria', name: 'Alegría', emoji: '😊', color: '#F0B429', bg: '#FFFBEB' },
  { id: 'tristeza', name: 'Tristeza', emoji: '😢', color: '#4299E1', bg: '#EBF8FF' },
  { id: 'enojo', name: 'Enojo', emoji: '😠', color: '#E53E3E', bg: '#FFF5F5' },
  { id: 'miedo', name: 'Miedo', emoji: '😨', color: '#7C3AED', bg: '#F5F0FF' },
  { id: 'frustracion', name: 'Frustración', emoji: '😤', color: '#DD6B20', bg: '#FFFAF0' },
  { id: 'verguenza', name: 'Vergüenza', emoji: '😳', color: '#D53F8C', bg: '#FFF5FA' },
  { id: 'decepcion', name: 'Decepción', emoji: '😞', color: '#718096', bg: '#F7FAFC' },
  { id: 'ansiedad', name: 'Ansiedad', emoji: '😰', color: '#38A169', bg: '#F0FFF4' },
];

export const emotionById = (id: string): EmotionInfo | undefined =>
  EMOTIONS.find((e) => e.id === id);

export const INSTITUCIONES = [
  'Colegio Americano',
  'Escuela Nacional Primaria',
  'Colegio La Salle',
  'Instituto Bilingüe',
  'Escuela Pública Central',
  'Colegio San Francisco',
];

export const logo = require('@/assets/logo.jpg');

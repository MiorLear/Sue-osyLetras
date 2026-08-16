import type { IconName } from './Icon';

export interface NavItem {
  /** Tile glyph used by the sidebar and the "Más" sheet. */
  emoji: string;
  label: string;
  href: string;
}

export interface TabItem {
  icon: IconName;
  label: string;
  href: string;
}

/** Full navigation for a teacher — the desktop sidebar and the "Más" sheet. */
export const TEACHER_NAV: NavItem[] = [
  { emoji: 'ℹ️', label: 'Sobre ExplorArte', href: '/sobre' },
  { emoji: '🏠', label: 'Inicio', href: '/main' },
  { emoji: '💛', label: 'Biblioteca de emociones', href: '/emociones' },
  { emoji: '🧰', label: 'Caja de herramientas', href: '/herramientas' },
  { emoji: '🌱', label: 'Aprendiendo', href: '/aprendiendo' },
  { emoji: '💬', label: 'Comunidad', href: '/comunidad' },
  { emoji: '🗓️', label: 'Calendario', href: '/calendar' },
  // No entra en MAIN_TABS: las cuatro pestañas del teléfono replican la app RN
  // a propósito, y esto es una pantalla de mantenimiento, no de uso diario.
  { emoji: '📥', label: 'Descargas', href: '/descargas' },
  // Siempre visible, no solo cuando hay algo que revisar: un menu que aparece y
  // desaparece desconcierta mas de lo que ayuda, y la pantalla tiene estado
  // vacio que responde la pregunta a quien entre por si acaso.
  { emoji: '⚠️', label: 'Cambios sin enviar', href: '/sync-problemas' },
  { emoji: '👤', label: 'Perfil', href: '/profile' },
];

/** Full navigation for the CMS. */
export const ADMIN_NAV: NavItem[] = [
  { emoji: 'ℹ️', label: 'Sobre ExplorArte', href: '/sobre' },
  { emoji: '🛠️', label: 'Panel', href: '/admin' },
  { emoji: '✅', label: 'Usuarios', href: '/admin/usuarios' },
  { emoji: '💛', label: 'Emociones', href: '/admin/emociones' },
  { emoji: '🧰', label: 'Herramientas', href: '/admin/herramientas' },
  { emoji: '🌱', label: 'Aprendiendo', href: '/admin/aprendiendo' },
  { emoji: '🎬', label: 'Videos de introducción', href: '/admin/videos-intro' },
  { emoji: '⚠️', label: 'Cambios sin enviar', href: '/sync-problemas' },
  { emoji: '👤', label: 'Perfil', href: '/profile' },
];

/**
 * Bottom tab bar on phones. Same four destinations, icons and order as
 * `MAIN_TABS` in the React Native app (`src/components/bottom-nav.tsx`), so the
 * PWA feels like the app the teachers already know. Everything else in
 * `TEACHER_NAV` lives behind the "Más" tab.
 */
export const MAIN_TABS: TabItem[] = [
  { icon: 'home', label: 'Inicio', href: '/main' },
  { icon: 'compass', label: 'Explora', href: '/emociones' },
  { icon: 'message-circle', label: 'Comunidad', href: '/comunidad' },
  { icon: 'user', label: 'Perfil', href: '/profile' },
];

/** The CMS has no RN counterpart; these mirror the top of ADMIN_NAV. */
export const ADMIN_TABS: TabItem[] = [
  { icon: 'home', label: 'Panel', href: '/admin' },
  { icon: 'check-circle', label: 'Usuarios', href: '/admin/usuarios' },
  { icon: 'compass', label: 'Emociones', href: '/admin/emociones' },
  { icon: 'user', label: 'Perfil', href: '/profile' },
];

/** True when `href` is the section the current `pathname` belongs to. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

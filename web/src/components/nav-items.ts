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

/**
 * Navegación principal de una docente — sidebar de escritorio y hoja "Más".
 *
 * Sugerencias del cliente (sep 2026): el menú lateral se queda en los tres
 * módulos de ExplorArte más Inicio, Comunidad y Perfil. Calendario, Descargas
 * y Cambios sin enviar salen de la navegación docente —Descargas porque los
 * descargables pertenecen al recurso que los contiene, y Cambios sin enviar
 * porque es mantenimiento editorial, no algo que una docente deba ver—. Las
 * rutas siguen existiendo para el CMS y para quien llegue por enlace directo.
 */
export const TEACHER_NAV: NavItem[] = [
  { emoji: '🏠', label: 'Inicio', href: '/main' },
  { emoji: '💛', label: 'Biblioteca de emociones', href: '/emociones' },
  { emoji: '🧰', label: 'Caja de herramientas', href: '/herramientas' },
  { emoji: '🌱', label: 'Aprendiendo sobre bienestar emocional', href: '/aprendiendo' },
  { emoji: '💬', label: 'Comunidad', href: '/comunidad' },
  { emoji: '👤', label: 'Perfil', href: '/profile' },
];

/** Full navigation for the CMS. */
export const ADMIN_NAV: NavItem[] = [
  { emoji: '🛠️', label: 'Panel', href: '/admin' },
  { emoji: '✅', label: 'Usuarios', href: '/admin/usuarios' },
  { emoji: '💛', label: 'Emociones', href: '/admin/emociones' },
  { emoji: '🧰', label: 'Herramientas', href: '/admin/herramientas' },
  { emoji: '🌱', label: 'Aprendiendo', href: '/admin/aprendiendo' },
  { emoji: '🎬', label: 'Videos de introducción', href: '/admin/videos-intro' },
  { emoji: '🗓️', label: 'Calendario', href: '/calendar' },
  { emoji: '📥', label: 'Descargas', href: '/descargas' },
  { emoji: '⚠️', label: 'Cambios sin enviar', href: '/sync-problemas' },
  { emoji: '👤', label: 'Perfil', href: '/profile' },
];

/**
 * Debajo de la navegación principal, separado por una línea: "Sobre
 * ExplorArte" es contexto institucional y no debe competir con los módulos
 * que la docente viene a usar.
 */
export const SECONDARY_NAV: NavItem[] = [
  { emoji: 'ℹ️', label: 'Sobre ExplorArte', href: '/sobre' },
];

/**
 * Bottom tab bar on phones. Las pestañas son Inicio y los tres módulos de
 * ExplorArte: son los destinos que el documento de estructura marca como
 * principales, y dejarlos detrás de "Más" era el motivo de que media app
 * quedara escondida en teléfono. Comunidad, Perfil y Sobre ExplorArte viven
 * en la hoja "Más" —Perfil también en el avatar de la barra superior—.
 */
export const MAIN_TABS: TabItem[] = [
  { icon: 'home', label: 'Inicio', href: '/main' },
  { icon: 'compass', label: 'Emociones', href: '/emociones' },
  { icon: 'wrench', label: 'Herramientas', href: '/herramientas' },
  { icon: 'sprout', label: 'Aprendiendo', href: '/aprendiendo' },
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

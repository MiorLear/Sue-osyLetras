import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  emoji: string;
  label: string;
  href: string;
}

const TEACHER_NAV: NavItem[] = [
  { emoji: 'ℹ️', label: 'Sobre ExplorArte', href: '/sobre' },
  { emoji: '🏠', label: 'Inicio', href: '/main' },
  { emoji: '💛', label: 'Biblioteca de emociones', href: '/emociones' },
  { emoji: '🧰', label: 'Caja de herramientas', href: '/herramientas' },
  { emoji: '🌱', label: 'Aprendiendo', href: '/aprendiendo' },
  { emoji: '💬', label: 'Comunidad', href: '/comunidad' },
  { emoji: '🗓️', label: 'Calendario', href: '/calendar' },
  { emoji: '👤', label: 'Perfil', href: '/profile' },
];

const ADMIN_NAV: NavItem[] = [
  { emoji: 'ℹ️', label: 'Sobre ExplorArte', href: '/sobre' },
  { emoji: '🛠️', label: 'Panel', href: '/admin' },
  { emoji: '✅', label: 'Usuarios', href: '/admin/usuarios' },
  { emoji: '💛', label: 'Emociones', href: '/admin/emociones' },
  { emoji: '🧰', label: 'Herramientas', href: '/admin/herramientas' },
  { emoji: '🌱', label: 'Aprendiendo', href: '/admin/aprendiendo' },
  { emoji: '👤', label: 'Perfil', href: '/profile' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isAdmin } = useAuth();

  const nav = isAdmin ? ADMIN_NAV : TEACHER_NAV;
  const initials = user
    ? ((user.name.charAt(0) || '') + (user.lastname.charAt(0) || '')).toUpperCase()
    : 'MR';
  const roleLabel = isAdmin ? 'Administradora' : user ? `Docente · ${user.institucion}` : 'Docente';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="logo-tile">E</span>
        <div>
          <div className="org">Sueños y Letras</div>
          <div className="name">ExplorArte</div>
        </div>
      </div>

      <div className="sidebar-kicker">Navegación</div>

      <nav className="sidebar-nav escroll">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <button
              key={item.href}
              className={active ? 'active' : ''}
              onClick={() => navigate(item.href)}
              aria-current={active ? 'page' : undefined}>
              <span className="tile">{item.emoji}</span>
              <span className="label">{item.label}</span>
              <span className="dot" />
            </button>
          );
        })}
      </nav>

      <button className="sidebar-user" onClick={() => navigate('/profile')}>
        {user?.photo ? (
          <img className="avatar" src={user.photo} alt="" />
        ) : (
          <span className="avatar">{initials}</span>
        )}
        <span className="meta">
          <span className="n">{user ? `${user.name} ${user.lastname}` : 'Mi perfil'}</span>
          <span className="e">{roleLabel}</span>
        </span>
        <span className="chev">›</span>
      </button>
    </aside>
  );
}

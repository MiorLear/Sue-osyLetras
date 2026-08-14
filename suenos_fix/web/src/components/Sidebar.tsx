import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Icon } from './Icon';
// Las listas viven en nav-items.ts para que la barra inferior de móvil y la
// hoja de "Más" naveguen exactamente lo mismo que el sidebar.
import { ADMIN_NAV, TEACHER_NAV, isActive } from './nav-items';

export function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const nav = isAdmin ? ADMIN_NAV : TEACHER_NAV;
  const initials = user
    ? ((user.name.charAt(0) || '') + (user.lastname.charAt(0) || '')).toUpperCase()
    : 'MR';
  const roleLabel = isAdmin ? 'Administradora' : user ? `Docente · ${user.institucion}` : 'Docente';
  const logout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

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
          const active = isActive(pathname, item.href);
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

      <button className="sidebar-logout" type="button" onClick={logout}>
        <Icon name="log-out" size={17} color="#C53030" />
        <span>Cerrar sesión</span>
      </button>

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

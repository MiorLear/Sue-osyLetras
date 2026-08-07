import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * Slim identity bar for phones. In standalone mode there is no browser chrome,
 * so without this the app opens straight into content with nothing above it —
 * and nothing padding the notch. Hidden on desktop, where the sidebar carries
 * the brand.
 */
export function MobileTopBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const initials = user
    ? ((user.name.charAt(0) || '') + (user.lastname.charAt(0) || '')).toUpperCase()
    : 'SL';

  return (
    <header className="mobile-topbar">
      <span className="mobile-topbar__logo" aria-hidden="true">
        E
      </span>
      <span className="mobile-topbar__name">ExplorArte</span>
      <button
        type="button"
        className="mobile-topbar__avatar"
        onClick={() => navigate('/profile')}
        aria-label="Ir a mi perfil">
        {user?.photo ? <img src={user.photo} alt="" /> : <span>{initials}</span>}
      </button>
    </header>
  );
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthResult, UserProfile } from '@explorarte/shared';
import { api } from '@/lib/api';
import { setCacheUser } from '@/lib/offline-cache';
import { refreshCounts } from '@/lib/outbox';
import { requestPersistentStorage } from '@/lib/storage-persist';
import { setFailedCount, setPendingCount } from '@/lib/sync-status';

interface AuthState {
  user: UserProfile | null;
  authed: boolean;
  isAdmin: boolean;
  /** mark the session as logged in with the authenticated user */
  signIn: (result: AuthResult) => void;
  signOut: () => void;
  setUser: (u: UserProfile) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'explorarte_token';
const USER_KEY = 'explorarte_user';

function readStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(() => readStoredUser());
  const [authed, setAuthed] = useState<boolean>(() => !!localStorage.getItem(TOKEN_KEY));

  // restore the profile if a token exists but the user wasn't persisted (e.g. older session)
  useEffect(() => {
    if (authed && !user) api.profile.get().then(setUserState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUser = (u: UserProfile) => {
    setUserState(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  };

  const signIn = (result: AuthResult) => {
    localStorage.setItem(TOKEN_KEY, result.token);
    setAuthed(true);
    setUser(result.user);
    // El ámbito de todo lo guardado sin conexión dependía solo del respaldo a
    // localStorage. Fijarlo explícitamente cierra la ventana entre iniciar
    // sesión y que el perfil esté escrito, y hace que los contadores se
    // recalculen bajo la usuaria correcta: en una tablet compartida, sin esto,
    // la segunda docente vería el número de cambios de la primera.
    setCacheUser(String(result.user.id));
    void refreshCounts();
    // Ahora sí hay contenido de alguien que proteger del desalojo del
    // navegador. Antes del login no lo había, y un permiso pedido demasiado
    // pronto es un permiso que se deniega (PWA-2.13).
    void requestPersistentStorage();
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthed(false);
    setUserState(null);
    setCacheUser(null);
    // A cero, para que el aviso no siga anunciando los cambios de la sesión
    // anterior en la pantalla de login. Las filas siguen en la tablet, acotadas
    // a su dueña, y replican cuando ella vuelva a entrar.
    setPendingCount(0);
    setFailedCount(0);
  };

  return (
    <AuthContext.Provider
      value={{ user, authed, isAdmin: user?.role === 'admin', signIn, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthResult, UserProfile } from '@explorarte/shared';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { clearUserEverything, getCacheUser, readCache, setCacheUser, writeCache } from '@/lib/offline-cache';
import { clearAuthToken, getAuthToken, restoreAuthToken, storeAuthToken } from '@/lib/auth-token';
import { clearMediaDownloads } from '@/lib/media-cache';
import { refreshCounts } from '@/lib/outbox';
import { requestPersistentStorage } from '@/lib/storage-persist';
import { setFailedCount, setPendingCount } from '@/lib/sync-status';

interface AuthState {
  user: UserProfile | null;
  authed: boolean;
  isAdmin: boolean;
  /** mark the session as logged in with the authenticated user */
  signIn: (result: AuthResult) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: UserProfile) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  // IndexedDB is asynchronous. Hold the route tree until the token and cache
  // scope are restored, otherwise a reload flashes the onboarding screen and
  // starts anonymous reads before discovering the active teacher.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await restoreAuthToken();
      if (!session || cancelled) {
        if (!cancelled) setReady(true);
        return;
      }
      setCacheUser(session.userId);
      setAuthed(true);
      const cached = await readCache<UserProfile>(cacheKeys.profile());
      if (!cancelled && cached) setUserState(cached);
      try {
        const fresh = await api.profile.get();
        if (!cancelled) {
          setUserState(fresh);
          void writeCache(cacheKeys.profile(), fresh);
        }
      } catch {
        // Offline startup may legitimately have only the cached profile. A
        // 401 clears module memory in api.ts; do not keep an authenticated UI.
        if (!getAuthToken() && !cancelled) {
          setAuthed(false);
          setUserState(null);
          setCacheUser(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setUser = (u: UserProfile) => {
    setUserState(u);
    void writeCache(cacheKeys.profile(), u);
  };

  const signIn = async (result: AuthResult) => {
    const userId = String(result.user.id);
    setCacheUser(userId);
    await storeAuthToken(result.token, userId);
    await writeCache(cacheKeys.profile(), result.user);
    setUserState(result.user);
    setAuthed(true);
    // El ámbito de todo lo guardado sin conexión dependía solo del respaldo a
    // localStorage. Fijarlo explícitamente cierra la ventana entre iniciar
    // sesión y que el perfil esté escrito, y hace que los contadores se
    // recalculen bajo la usuaria correcta: en una tablet compartida, sin esto,
    // la segunda docente vería el número de cambios de la primera.
    void refreshCounts();
    // Ahora sí hay contenido de alguien que proteger del desalojo del
    // navegador. Antes del login no lo había, y un permiso pedido demasiado
    // pronto es un permiso que se deniega (PWA-2.13).
    void requestPersistentStorage();
  };

  const signOut = async () => {
    const userId = user ? String(user.id) : getCacheUser();
    setAuthed(false);
    setUserState(null);
    // clearAuthToken drops module memory before its first await, so no request
    // started during cleanup can leave under the previous teacher's bearer.
    await Promise.all([
      clearAuthToken(),
      clearUserEverything(userId),
      clearMediaDownloads(),
    ]);
    setCacheUser(null);
    // A cero, para que el aviso no siga anunciando cambios de la sesión
    // anterior mientras la limpieza elimina también sus filas pendientes.
    setPendingCount(0);
    setFailedCount(0);
  };

  if (!ready) return null;

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

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserProfile } from '@explorarte/shared';
import { api } from '@/lib/api';

interface AuthState {
  user: UserProfile | null;
  authed: boolean;
  isAdmin: boolean;
  /** mark the session as logged in with the authenticated user */
  signIn: (user: UserProfile) => void;
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

  const signIn = (u: UserProfile) => {
    localStorage.setItem(TOKEN_KEY, 'mock-token');
    setAuthed(true);
    setUser(u);
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthed(false);
    setUserState(null);
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

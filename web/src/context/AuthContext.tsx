import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserProfile } from '@explorarte/shared';
import { api } from '@/lib/api';

interface AuthState {
  user: UserProfile | null;
  authed: boolean;
  /** mark the session as logged in and load the profile */
  signIn: () => Promise<void>;
  signOut: () => void;
  setUser: (u: UserProfile) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'explorarte_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authed, setAuthed] = useState<boolean>(() => !!localStorage.getItem(TOKEN_KEY));

  const loadProfile = async () => {
    const p = await api.profile.get();
    setUser(p);
  };

  // restore profile if a session token is already present
  useEffect(() => {
    if (authed && !user) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async () => {
    localStorage.setItem(TOKEN_KEY, 'mock-token');
    setAuthed(true);
    await loadProfile();
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthed(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authed, signIn, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

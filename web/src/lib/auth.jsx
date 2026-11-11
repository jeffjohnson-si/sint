import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { tokens } from './api.js';
import * as sint from './sint.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Restore the session on first paint: the tokens are in localStorage, the
  // user object is not. A 401 here means the refresh token is dead too.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokens.access() && !tokens.refresh()) {
        setReady(true);
        return;
      }
      try {
        const data = await sint.me();
        if (!cancelled) setUser(data.user);
      } catch {
        tokens.clear();
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = useCallback((data) => {
    tokens.save(data.accessToken, data.refreshToken);
    setUser(data.user);
    // The full payload goes back so callers can read `devCode` and
    // `user.emailVerified` (sign up now continues into email confirmation).
    return data;
  }, []);

  const signIn = useCallback(
    async (email, password) => accept(await sint.signIn(email, password)),
    [accept],
  );

  const signUp = useCallback(async (body) => accept(await sint.signUp(body)), [accept]);

  /** Used by the development shortcut, which hands back a ready-made session. */
  const acceptSession = useCallback((data) => accept(data), [accept]);

  const signOut = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  const updateUser = useCallback((changes) => {
    setUser((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const reloadUser = useCallback(async () => {
    const data = await sint.me();
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut, updateUser, reloadUser, acceptSession }),
    [user, ready, signIn, signUp, signOut, updateUser, reloadUser, acceptSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

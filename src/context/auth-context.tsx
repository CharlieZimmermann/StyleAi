import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  /** null while signed out, otherwise the active Supabase session. */
  session: Session | null;
  /** true only until the initial "am I already logged in?" check finishes. */
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

/**
 * Wraps the app, tracks the current Supabase auth session, and keeps it in
 * sync. src/app/_layout.tsx reads this via useAuth() to decide whether to
 * show the (auth) screens or the (tabs) screens.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for a session already persisted in AsyncStorage from a
    // previous app launch.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Keep session in sync after that: fires on sign in, sign out, and
    // token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

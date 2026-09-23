import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { ensureUserProfile } from '@/lib/profile';
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
    supabase.auth.getSession().then(async ({ data }) => {
      let current = data.session;

      // getSession only reads the token saved on the phone -- it can't tell
      // that the account behind it was deleted (e.g. removed in the Supabase
      // dashboard), and a deleted account's token keeps "working" until it
      // expires. Ask the server, and sign out only if it says the account is
      // definitively gone. Network errors (status 0 / 5xx) are ignored so a
      // flaky connection doesn't log anyone out.
      if (current) {
        const { error } = await supabase.auth.getUser();
        if (error && error.status !== undefined && [401, 403, 404].includes(error.status)) {
          await supabase.auth.signOut();
          current = null;
        } else {
          await ensureUserProfile(current.user.id, current.user.email);
        }
      }

      setSession(current);
      setLoading(false);
    });

    // Keep session in sync after that: fires on sign in, sign out, and
    // token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) void ensureUserProfile(newSession.user.id, newSession.user.email);
    });

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

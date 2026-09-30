import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { ensureUserProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  /** null while signed out, otherwise the active Supabase session. */
  session: Session | null;
  /** true only until the initial "am I already logged in?" check finishes. */
  loading: boolean;
  /**
   * true while handling a password-recovery link. A recovery link creates a
   * real session (so the user can call updateUser to set a new password),
   * but src/app/_layout.tsx must NOT treat that as a normal sign-in and jump
   * to the main app -- it shows /reset-password instead, while this is true.
   */
  recoveryMode: boolean;
  /** Call after the user has set a new password, to return to normal routing. */
  exitRecoveryMode: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  recoveryMode: false,
  exitRecoveryMode: () => {},
});

/**
 * Recovery links put access_token/refresh_token/type=recovery after a `#`,
 * not a `?` -- a common gotcha, since most URL parsing assumes query params.
 * See https://supabase.com/docs/guides/auth/native-mobile-deep-linking
 */
function parseRecoveryTokens(url: string): { access_token: string; refresh_token: string } | null {
  const fragment = url.split('#')[1] ?? url.split('?')[1];
  if (!fragment) return null;

  const params = new URLSearchParams(fragment);
  if (params.get('type') !== 'recovery') return null;

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

/**
 * Wraps the app, tracks the current Supabase auth session, and keeps it in
 * sync. src/app/_layout.tsx reads this via useAuth() to decide whether to
 * show the (auth) screens, the (tabs) screens, or /reset-password.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

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
    // token refresh. Supabase is meant to fire 'PASSWORD_RECOVERY' instead
    // of 'SIGNED_IN' for a recovery-link session, but that event has known
    // reliability gaps when the session comes from a manual setSession()
    // call (our case) rather than the client's own URL auto-detection --
    // so it's a secondary signal here, not the only one. The deep-link
    // handler below sets recoveryMode directly, before setSession is even
    // called, which is the primary mechanism.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (newSession) void ensureUserProfile(newSession.user.id, newSession.user.email);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle password-recovery links: both a cold start via the link, and the
  // app already running when the link is tapped.
  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url) return;
      const tokens = parseRecoveryTokens(url);
      if (!tokens) return;

      setRecoveryMode(true); // before establishing the session -- see note above
      const { error } = await supabase.auth.setSession(tokens);
      if (error) {
        console.error('Failed to establish session from recovery link:', error);
        setRecoveryMode(false);
      }
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => void handleUrl(url));
    return () => subscription.remove();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, loading, recoveryMode, exitRecoveryMode: () => setRecoveryMode(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

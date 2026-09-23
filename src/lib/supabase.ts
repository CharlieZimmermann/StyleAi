import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env.local, fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from your Supabase ' +
      'project (Project Settings -> API Keys), then restart `npx expo start`.',
  );
}

// One shared client for the whole app. The publishable key is safe to ship
// in the app bundle -- Row Level Security (see supabase/schema.sql) is what
// actually protects each user's data, not secrecy of this key.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Persist the session in AsyncStorage so users stay logged in between
    // app launches.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There's no browser URL bar in React Native to read a session token
    // from, unlike Supabase's web quickstarts.
    detectSessionInUrl: false,
  },
});

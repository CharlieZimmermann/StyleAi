// Runs before any test file. Jest (unlike Expo's own dev server/Metro)
// doesn't load .env.local, and src/lib/supabase.ts throws at import time if
// these are missing -- which would otherwise break every test that imports
// anything transitively depending on it, even tests that never touch
// Supabase themselves. createClient() doesn't make any network call just
// from being constructed, so placeholder values are fine here.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'test-placeholder-key';

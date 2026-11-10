# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

StyleAi (Expo/React Native + Supabase) is a working app, not a skeleton: auth
(sign up/login/password reset/change/account deletion), a closet catalog
with AI photo tagging and manual edit/delete, weather-driven daily outfits,
event-based outfits, a manual outfit builder, saved/favorite outfits, and an
AI wardrobe gap-finder are all built and wired end-to-end. Check
`docs/technical-architecture.md`'s build order for what's still open (UI
polish, tests) before assuming a feature doesn't exist.

## Commands

- `npm run lint` — ESLint (`expo lint`)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Jest (`jest-expo` preset); tests live in `__tests__/` folders
  next to the code they cover, and are intentionally scoped to pure logic
  only (e.g. `localDateString`, `clothingItemLabel`, `parseTagList`) --
  nothing that touches Supabase/network. Needs the `moduleNameMapper`
  entries in `package.json`'s `jest` config (path alias resolution and the
  official AsyncStorage mock; Jest doesn't get either "for free" the way
  Metro/the app runtime does) and `jest.setup.ts` (fake env vars, since
  `src/lib/supabase.ts` throws at import time without them, and Jest --
  unlike Expo's dev server -- doesn't load `.env.local`).
- `npx --yes deno check --config supabase/functions/deno.json supabase/functions/*/index.ts` —
  typecheck the Edge Functions; they're Deno, not part of the app's `tsc`
  project (excluded in `tsconfig.json`), so `npm run typecheck` does not
  cover them. The `--config` flag matters: without it, Deno's config search
  starts at the repo root (the command's cwd) and walks upward, past
  `supabase/functions/deno.json` entirely, so it falls back to
  auto-detecting the root `package.json` as a workspace member and demands
  a `node_modules/` directory for every npm specifier it finds there --
  including the whole app's dependency tree, not just this function's own
  `npm:@supabase/supabase-js@2`. That only "worked" locally because the
  app's `node_modules` happened to already exist; CI's Edge Functions job
  never runs `npm ci`, so it failed there even though it passed locally --
  always use the `--config` flag (and keep `supabase/functions/deno.lock`,
  not a root `deno.lock`, as the lockfile) so this stays self-contained.
- `npx --yes deno test --config supabase/functions/deno.json supabase/functions/*/logic.test.ts` —
  the Edge Functions' own pure-logic tests (same `--config` reasoning as
  above). Each function's `index.ts` calls `Deno.serve(...)` at module load
  time, so its testable logic lives in a sibling `logic.ts` that `index.ts`
  imports from -- importing `index.ts` itself in a test would start an
  actual server listener.
- `npx expo start` — dev server (interactive; not something to run and wait
  on non-interactively)
- `.github/workflows/ci.yml` runs all of the above on every push/PR to `main`

## Source-of-truth docs

- `docs/technical-architecture.md` — the authoritative stack and schema doc.
- `docs/wardrobe-app-project-description.md` — the original product pitch and
  MVP feature list. **Its "Recommended tech stack" table is stale**: the
  project uses Supabase (Postgres + Auth + Storage + Edge Functions), not the
  Node/Express + Prisma + Clerk + Cloudinary stack that doc lists. Wherever
  the two docs disagree, `technical-architecture.md` wins.
- Both docs (and some in-repo comments) still say "Closet" -- that was the
  working name before the app was renamed to StyleAi. Left as-is; they're a
  historical planning record, not living branding.

## Database (`supabase/schema.sql`)

The whole backend is Supabase: hosted Postgres, built-in auth, file storage,
and an auto-generated API — there is no hand-rolled REST/GraphQL server.
API calls needing a secret (Gemini, and the admin-only account deletion) run
in Supabase Edge Functions, never in the mobile app.

`supabase/schema.sql` is applied by hand via the Supabase dashboard's SQL
Editor or `npx supabase db query --linked --file <path>` (there's no
`supabase/config.toml`/CLI migrations set up). It is the single source of
truth for the schema; read it directly for full column definitions. Section
5b at the bottom is a running log of small `alter table`/`create table if
not exists` blocks applied after the initial setup -- when adding a column
or table, add a block there (and actually run it against the live project;
it's easy to write the SQL and forget to apply it, which has happened more
than once in this project's history and produced confusing runtime errors).
Key architectural points that span the file and aren't obvious from any one
part of it:

- **Ownership model**: every user-owned table has a `user_id` (or reaches one
  through a parent) referencing `public.users.id`, which itself references
  `auth.users.id`. A `handle_new_user()` trigger on `auth.users` auto-creates
  the matching `public.users` row on sign-up. The client also self-heals this
  (`ensureUserProfile` in `src/lib/profile.ts`, called from
  `AuthProvider`) in case the row is ever missing -- without it, every insert
  into a user-owned table fails its foreign key check with a confusing error.
- **RLS everywhere**: every table has Row Level Security enabled with
  "own rows only" policies. `outfit_items` and `wear_log` have no direct
  `user_id`-only check in the naive sense — their policies verify ownership
  through the parent `outfits`/`clothing_items` row, so a user can't link
  someone else's clothing item into their own outfit.
- **Photo storage convention**: the `clothing-images` Storage bucket is
  private. Every object path must be `<user_id>/<filename>` — the storage
  policies key off the first path segment matching `auth.uid()`. Since the
  bucket isn't public, the app must request signed URLs to display images;
  `clothing_items.image_url` stores the storage *path*, not a public URL.
- **Supabase key names**: the platform's auto-injected Edge Function env vars
  changed shape -- `SUPABASE_PUBLISHABLE_KEYS`/`SUPABASE_SECRET_KEYS` are now
  JSON objects keyed by name (read the `"default"` entry), with the old
  singular plain-string names (`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`)
  kept only as a deprecated fallback. `supabase/functions/_shared/env-keys.ts`
  centralizes this lookup (checks current shape first, then legacy) --
  Edge Functions should get their key via `getPublishableKey()`/
  `getSecretKey()` from there, not by reading `Deno.env` directly. The
  publishable key is safe in the mobile app; the secret key bypasses all RLS
  and must only ever be used server-side, never committed or shipped in the
  app.
- **One daily outfit per day**: enforced by a partial unique index on
  `outfits (user_id, outfit_date) where outfit_type = 'daily'`, not
  application logic. `outfit_type` is `'daily' | 'event' | 'manual'` --
  `manual` outfits (built by hand in the app, no AI) are auto-saved
  (`is_saved: true`) since there's no separate history screen for them; they
  surface in Closet > Saved Outfits like any other starred outfit.
- **`ai_call_log`**: backs a per-user, per-function daily rate limit on the
  three AI Edge Functions (`supabase/functions/_shared/rate-limit.ts`),
  so a UI bug or rapid repeated taps can't exhaust the free-tier Gemini
  quota for the whole app. Logging a call is `await`ed, not fire-and-forget
  -- an Edge Function's isolate can be frozen the instant a response is
  returned, which would silently drop an un-awaited write.
- **RLS testing recipe**: the commented-out block in `schema.sql` is the
  pattern for verifying policies manually in the SQL Editor. It matters
  because the SQL Editor normally runs as a privileged role that bypasses
  RLS entirely — the recipe drops to `set local role authenticated` and
  fakes `request.jwt.claims` to impersonate a specific user, inside a
  transaction that's rolled back. Reuse this pattern rather than trusting a
  plain `select` in the SQL Editor to reflect what the app will actually see.

## Edge Functions (`supabase/functions/`)

Four functions, all Deno, all deployed with `npx supabase functions deploy
<name>` (default JWT verification stays on -- never deploy with
`--no-verify-jwt`):

- `tag-clothing-item` — Gemini vision, tags + titles a clothing photo.
- `generate-outfit` — Gemini text, picks an outfit from the closet + Open-Meteo
  weather + wear history; validates the AI's picks structurally (real item
  ids, exactly one shoe, complete top+bottom or dress, sane extras) before
  saving.
- `suggest-wardrobe-gaps` — Gemini text, suggests missing staples; builds a
  plain web-search link per suggestion itself (never trusts a URL from the
  AI's own output).
- `delete-account` — the one function using the *secret* key (admin API), to
  delete the caller's own `auth.users` row (which cascades through every
  other table). The id passed to `admin.deleteUser` always comes from the
  caller's own JWT, never client input, so it can only ever delete the
  caller's own account.

Three of the four (all but `tag-clothing-item`) forward the caller's JWT to
a Supabase client instead of using the secret key, so RLS applies exactly as
it does in the app. `_shared/gemini.ts` holds a shared model-fallback chain
(tries several Gemini models in order; a structural validation failure is
treated the same as an API error and also triggers fallback) used by all
three AI functions -- add new Gemini call sites through `generateJson()`
there rather than duplicating the retry logic.

## Animation (react-native-reanimated)

`app.json` has `experiments.reactCompiler: true`. React Compiler's
immutability analysis doesn't know Reanimated's shared-value mutation model
is intentional, and flags a plain `sv.value = ...` write (or even a bare
`.value` read in some positions) as illegal mutation --
`react-hooks/immutability` lint errors, not a real bug. Use `sv.get()` /
`sv.set(...)` instead of `.value` everywhere in this codebase (Reanimated's
own React-Compiler-compliant alternative, same behavior) -- see
`src/components/animated-pressable.tsx` and `outfit-card.tsx`'s star bounce
for the pattern. `AnimatedPressable` (tactile press-shrink feedback) and
`CardShadow` (`src/constants/theme.ts`) are the two shared building blocks
for new UI -- reach for those instead of a bare `Pressable`/flat card.

## Auth deep links

Password reset (`src/context/auth-context.tsx` + `src/app/reset-password.tsx`)
listens for the incoming `styleai://` (or `exp://` in Expo Go) link, parses
tokens from the URL's `#` fragment (not `?query` -- a common gotcha), and
calls `setSession`. Establishing a session this way does *not* reliably fire
Supabase's `PASSWORD_RECOVERY` auth event (a documented gap when the session
comes from a manual `setSession()` call rather than the client's own URL
auto-detection), so the app doesn't rely on that event alone -- a
`recoveryMode` flag is set directly by the deep-link handler, before
`setSession` is even called, and `_layout.tsx`'s `Stack.Protected` guards
check it ahead of the normal signed-in/signed-out split. Needs a redirect
URL allow-listed in the Supabase dashboard (Authentication → URL
Configuration) -- not something doable from the CLI/SQL.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is a very early-stage project. Only Step 1 of the build order (Supabase
project setup) is done — there is no application code yet (no `package.json`,
no Expo app). Do not invent build/lint/test commands; none exist until Step 2
(Expo project setup) is done. Check for a `package.json` before assuming any
tooling is in place.

## Source-of-truth docs

- `docs/technical-architecture.md` — the authoritative stack and schema doc.
- `docs/wardrobe-app-project-description.md` — the original product pitch and
  MVP feature list. **Its "Recommended tech stack" table is stale**: the
  project uses Supabase (Postgres + Auth + Storage + Edge Functions), not the
  Node/Express + Prisma + Clerk + Cloudinary stack that doc lists. Wherever
  the two docs disagree, `technical-architecture.md` wins.

## Database (`supabase/schema.sql`)

The whole backend is Supabase: hosted Postgres, built-in auth, file storage,
and an auto-generated API — there is no hand-rolled REST/GraphQL server.
Secret-key API calls (Claude, weather) are meant to run in Supabase Edge
Functions, never in the mobile app.

`supabase/schema.sql` is applied by hand via the Supabase dashboard's SQL
Editor (there's no `supabase/config.toml` or CLI migrations set up). It is
the single source of truth for the schema; read it directly for full column
definitions. Key architectural points that span the file and aren't obvious
from any one part of it:

- **Ownership model**: every user-owned table has a `user_id` (or reaches one
  through a parent) referencing `public.users.id`, which itself references
  `auth.users.id`. A `handle_new_user()` trigger on `auth.users` auto-creates
  the matching `public.users` row on sign-up — the app never creates that row
  itself.
- **RLS everywhere**: all 6 tables have Row Level Security enabled with
  "own rows only" policies. `outfit_items` and `wear_log` have no direct
  `user_id`-only check in the naive sense — their policies verify ownership
  through the parent `outfits`/`clothing_items` row, so a user can't link
  someone else's clothing item into their own outfit.
- **Photo storage convention**: the `clothing-images` Storage bucket is
  private. Every object path must be `<user_id>/<filename>` — the storage
  policies key off the first path segment matching `auth.uid()`. Since the
  bucket isn't public, the app must request signed URLs to display images;
  `clothing_items.image_url` stores the storage *path*, not a public URL.
- **Supabase key names**: use the current `sb_publishable_...` /
  `sb_secret_...` keys (not the legacy `anon`/`service_role` names). The
  publishable key is safe in the mobile app; the secret key bypasses all RLS
  and must only ever be used server-side (Edge Function secrets), never
  committed or shipped in the app.
- **One daily outfit per day**: enforced by a partial unique index on
  `outfits (user_id, outfit_date) where outfit_type = 'daily'`, not
  application logic.
- **RLS testing recipe**: the commented-out block at the bottom of
  `schema.sql` is the pattern for verifying policies manually in the SQL
  Editor. It matters because the SQL Editor normally runs as a privileged
  role that bypasses RLS entirely — the recipe drops to `set local role
  authenticated` and fakes `request.jwt.claims` to impersonate a specific
  user, inside a transaction that's rolled back. Reuse this pattern rather
  than trusting a plain `select` in the SQL Editor to reflect what the app
  will actually see.

## Build order

`docs/technical-architecture.md`'s "Suggested build order" section is the
roadmap (Supabase setup → Expo + auth → closet catalog → weather/daily
outfit → event-based outfit → save-outfit → gap-finder → UI polish →
stretch features). Consult it before assuming what's next.

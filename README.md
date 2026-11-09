# StyleAi

An AI-powered wardrobe app: photograph your clothes, get an AI-tagged digital
closet, and receive a daily outfit suggestion based on the weather and what
you actually own — plus outfits for specific occasions, favorites, and a
wardrobe gap-finder that suggests what to buy next.

## Features

- **AI closet catalog** — photograph a clothing item and Gemini vision tags
  its category, color, season, and a title automatically; every field stays
  manually editable
- **Weather-driven daily outfits** — one AI-generated outfit per day, built
  from your actual closet and the real-time weather at your location (GPS,
  falling back to a saved home city)
- **Event-based outfits** — describe an occasion ("job interview", "golf
  outing") and get an outfit suited to it, alongside the daily one
- **Manual outfit builder** — hand-pick items into an outfit, no AI involved,
  for when you already know what you want to wear
- **Saved/favorite outfits** — star any outfit (AI or manual) to keep it
- **Wardrobe gap-finder** — AI suggestions for staples missing from your
  closet, based on your budget, brands, and style preferences, each with a
  ready-made shopping search link
- **Wear log** — track when you actually wore an outfit
- **Full account lifecycle** — sign up, password reset via email deep link,
  in-app password change, and account deletion
- Daily per-user rate limiting on every AI call, so a UI bug can't exhaust
  the API quota

## Stack

- **App:** Expo (React Native) + TypeScript, Expo Router
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions) — no
  separate server
- **AI:** Google Gemini (vision for item tagging, text for outfit/gap
  suggestions), called from Edge Functions so the API key never reaches the
  app
- **Weather:** [Open-Meteo](https://open-meteo.com/) (free, no API key)

See [`CLAUDE.md`](./CLAUDE.md) for the non-obvious architectural details
(RLS policies, the storage path convention, the model-fallback pattern in
the Edge Functions, etc.) and `docs/technical-architecture.md` for the
original design doc.

## Prerequisites

- Node.js and npm
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase`
  works too — no separate install needed)
- A Supabase project with `supabase/schema.sql` applied (via the SQL Editor)
  and the project linked locally (`supabase link --project-ref ...`)
- A free [Gemini API key](https://aistudio.google.com/apikey), set as an Edge
  Function secret: `supabase secrets set GEMINI_API_KEY=...`
- Expo Go on your phone, for the fastest way to run it

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + publishable key
npx supabase functions deploy tag-clothing-item
npx supabase functions deploy generate-outfit
npx supabase functions deploy suggest-wardrobe-gaps
npx expo start
```

Then scan the QR code with Expo Go (iOS) or the Expo Go app (Android).

## Scripts

- `npm start` / `npx expo start` — run the dev server
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Jest (pure-logic tests only; see `CLAUDE.md` for why)
- `npx deno check supabase/functions/*/index.ts` — typecheck the Edge
  Functions (they're Deno, not part of the app's TypeScript project)
- `npx deno test supabase/functions/*/logic.test.ts` — the Edge Functions'
  own pure-logic tests

All of the above run in CI on every push/PR to `main`
(`.github/workflows/ci.yml`).

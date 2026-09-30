# StyleAi

An AI-powered wardrobe app: photograph your clothes, get an AI-tagged digital
closet, and receive a daily outfit suggestion based on the weather and what
you actually own — plus outfits for specific occasions, favorites, and a
wardrobe gap-finder that suggests what to buy next.

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
- `npx tsc --noEmit` — typecheck
- `npx deno check supabase/functions/*/index.ts` — typecheck the Edge
  Functions (they're Deno, not part of the app's TypeScript project)

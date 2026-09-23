# Technical Architecture: Closet App

## Full stack overview

| Layer | Choice | Why (beginner-friendly reasoning) |
|---|---|---|
| Mobile frontend | React Native + Expo, TypeScript | One codebase for iOS & Android. Expo Go lets you preview the app live on your own phone in seconds, no Xcode/Android Studio setup needed to start. |
| Backend / Database / Auth / Storage | **Supabase** | Hosted PostgreSQL + built-in auth + file storage + auto-generated API, all in one dashboard. You write SQL to define tables and call Supabase directly from the app — no server to build, host, or maintain for basic CRUD. Free tier is generous for a resume project. |
| Secure AI + external API calls | Supabase Edge Functions (Deno-based serverless functions) | Anything that needs a secret API key (Claude API, weather API) must run server-side, never in the mobile app itself. Edge Functions are small, deploy with one CLI command, and live right next to your database. |
| AI vision & tagging | Claude API (vision) | Auto-categorizes and describes uploaded clothing photos |
| Outfit generation logic | Claude API (text) | Given wardrobe inventory + weather + occasion + style history, generates outfit picks with reasoning |
| Weather data | OpenWeatherMap API | Powers the daily auto-generated outfit |
| Product discovery (gap-finder) | Google Shopping API or an affiliate network (Rakuten Advertising, Skimlinks) | Reliable, ToS-compliant way to surface real purchasable products — avoids the fragility/legal risk of scraping retailer sites directly |
| Animation | React Native Reanimated + Moti | Smooth, performant transitions without fighting React Native's animation API directly |

### Why this is easier than a "traditional" full-stack setup
A more traditional setup would have you writing a Node/Express server, hosting it somewhere (Render, Railway, etc.), and manually writing every API endpoint for basic operations like "get all my clothing items." Supabase replaces most of that: define a table, and you already have a secure API for reading/writing to it. You only write custom backend code (Edge Functions) for the parts that actually need custom logic — calling Claude, calling the weather API. That's a much smaller surface area to learn while still being a legitimate, resume-relevant stack.

---

## Database schema (PostgreSQL, run via Supabase's SQL editor)

```sql
-- Extends Supabase's built-in auth.users table with app-specific profile info
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  budget_min integer,
  budget_max integer,
  preferred_brands text[],       -- e.g. {'Nike','Uniqlo','J.Crew'}
  style_tags text[],             -- e.g. {'minimalist','streetwear'}
  created_at timestamptz default now()
);

create type clothing_category as enum (
  't_shirt', 'shirt', 'sweatshirt', 'hoodie',
  'pants', 'formal_pants', 'shoes', 'hat', 'accessory'
);

create table public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category clothing_category not null,
  color text,
  brand text,
  season text,                   -- e.g. 'summer', 'winter', 'all_season'
  image_url text not null,
  ai_tags jsonb,                 -- raw AI-generated tags/description, for flexibility
  created_at timestamptz default now()
);

create type outfit_type as enum ('daily', 'event', 'manual');

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  outfit_type outfit_type not null,
  event_prompt text,             -- e.g. "interview", "golf outing" — null for daily outfits
  weather_snapshot jsonb,        -- weather conditions at generation time, for context
  is_saved boolean default false,
  created_at timestamptz default now()
);

-- Join table: which clothing items belong to which outfit (many-to-many)
create table public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  clothing_item_id uuid not null references public.clothing_items(id) on delete cascade
);

create type suggestion_status as enum ('suggested', 'dismissed', 'purchased');

create table public.wishlist_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_name text not null,
  brand text,
  price numeric,
  product_url text,
  image_url text,
  reason text,                   -- why the AI suggested this (e.g. "you don't have a plain white tee")
  status suggestion_status default 'suggested',
  created_at timestamptz default now()
);
```

### How the tables connect
- Every `clothing_items` row belongs to one `users` row.
- An `outfits` row represents one generated or saved outfit — it doesn't store the items directly. Instead, `outfit_items` links an outfit to each item in it, which is what lets a single item (say, your favorite jeans) show up across many different outfits.
- `wishlist_suggestions` is independent of outfits — it's the output of the gap-finder feature, tracked per user with a status you update as they act on it.

### A note on Row Level Security (RLS)
Supabase makes tables publicly queryable by default until you turn on Row Level Security and write policies. Before you store real data, you'll want a policy like "users can only read/write their own rows" on every table — this is a standard, well-documented Supabase step and worth doing early rather than bolting on later.

---

## Suggested build order (updated)
1. Create Supabase project, run the schema above, enable Row Level Security with basic "own data only" policies
2. Set up Expo project, connect Supabase client, build auth screens (sign up/login)
3. Closet catalog: photo upload → Edge Function calls Claude vision to auto-tag → save to `clothing_items` → browsable/filterable views by category
4. Weather integration (Edge Function calling OpenWeatherMap) + daily auto-generated outfit (Edge Function calling Claude with wardrobe + weather context)
5. Event-based outfit prompt: text input → Edge Function calls Claude with wardrobe + occasion context
6. Save-outfit feature (toggle `is_saved` on an outfit row)
7. Wardrobe gap-finder: Edge Function identifies missing staples → queries shopping API filtered by budget/brand → writes to `wishlist_suggestions`
8. UI/UX polish pass: animations, transitions, empty states, onboarding
9. Stretch features if time allows

-- =====================================================================
-- Closet app: Supabase schema
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste this
-- whole file -> Run. Run it ONCE on a fresh project (re-running errors with
-- "already exists"). To change things later, write a new small script
-- instead of editing and re-running this one.
--
-- SUPABASE KEYS (Project Settings -> API Keys):
--   * Publishable key  (starts with sb_publishable_...)
--       Replaces the older "anon" key. Safe to put in the mobile app
--       because Row Level Security (section 4 below) protects the data.
--   * Secret key       (starts with sb_secret_...)
--       Replaces the older "service_role" key. It BYPASSES all Row Level
--       Security. Never put it in the mobile app, never commit it to git.
--       Use it only inside Edge Functions (as a Supabase secret).
--   Older projects may still show "anon" / "service_role" (legacy tab);
--   the rules are identical.
--
-- STORAGE CONVENTION: every photo path must be   <user_id>/<filename>
--   e.g.  3f2a...-uuid/blue-tee.jpg
--   The storage policies (section 5) only allow a user to read/write files
--   whose first folder equals their own user id. clothing_items.image_url
--   stores that path (the bucket is private, so the app requests
--   temporary signed URLs to display images).
-- =====================================================================


-- =====================================================================
-- 1. TYPES (fixed lists of allowed values)
-- =====================================================================
create type clothing_category as enum (
  't_shirt', 'shirt', 'sweatshirt', 'hoodie',
  'pants', 'formal_pants', 'shorts', 'dress_skirt',
  'outerwear', 'shoes', 'hat', 'accessory'
);

create type season_type as enum (
  'spring', 'summer', 'fall', 'winter', 'all_season'
);

create type outfit_type as enum ('daily', 'event', 'manual');

create type suggestion_status as enum ('suggested', 'dismissed', 'purchased');


-- =====================================================================
-- 2. TABLES
-- =====================================================================

-- App-specific profile, one row per signed-up user
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  home_city text,                -- fallback if the user denies GPS permission
  budget_min integer,
  budget_max integer,
  preferred_brands text[],       -- e.g. {'Nike','Uniqlo','J.Crew'}
  style_tags text[],             -- e.g. {'minimalist','streetwear'}
  created_at timestamptz default now()
);

create table public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text,                    -- e.g. "Green Day Tour T-Shirt"; null falls back to category
  category clothing_category not null,
  color text,
  brand text,
  season season_type,
  purchase_price numeric,        -- for the cost-per-wear stretch feature
  image_url text not null,       -- storage path: <user_id>/<filename>
  ai_tags jsonb,                 -- raw AI-generated tags/description
  created_at timestamptz default now()
);

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  outfit_type outfit_type not null,
  outfit_date date not null default current_date,
  event_prompt text,             -- e.g. "interview"; null for daily outfits
  weather_snapshot jsonb,        -- weather at generation time
  is_saved boolean not null default false,
  created_at timestamptz default now()
);

-- At most one "daily" outfit per user per day
create unique index one_daily_outfit_per_day
  on public.outfits (user_id, outfit_date)
  where outfit_type = 'daily';

-- Which clothing items are in which outfit (many-to-many)
create table public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  clothing_item_id uuid not null references public.clothing_items(id) on delete cascade,
  unique (outfit_id, clothing_item_id)
);

-- Which day each item was worn (powers "unworn recently", laundry tracking,
-- and cost-per-wear)
create table public.wear_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  clothing_item_id uuid not null references public.clothing_items(id) on delete cascade,
  worn_on date not null default current_date,
  created_at timestamptz default now()
);

create table public.wishlist_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_name text not null,
  brand text,
  price numeric,
  product_url text,
  image_url text,
  reason text,                   -- why it was suggested
  status suggestion_status not null default 'suggested',
  created_at timestamptz default now()
);

-- Indexes so "get my items" style lookups stay fast
create index on public.clothing_items (user_id);
create index on public.outfits (user_id);
create index on public.outfit_items (outfit_id);
create index on public.wear_log (user_id, worn_on);
create index on public.wear_log (clothing_item_id);
create index on public.wishlist_suggestions (user_id);


-- =====================================================================
-- 3. AUTO-CREATE A PROFILE ROW WHEN SOMEONE SIGNS UP
-- =====================================================================
-- "security definer" lets this run with elevated rights, because a brand
-- new user has no permission yet to write their own profile row.
-- "set search_path = ''" is Supabase's recommended safety setting for that.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =====================================================================
-- 4. ROW LEVEL SECURITY: each user can only touch their own rows
--    "using" = which rows you can see/change; "with check" = what you may
--    write. (select auth.uid()) = the logged-in user's id (wrapping it in
--    select is a Supabase performance tip; behavior is the same).
-- =====================================================================
alter table public.users                enable row level security;
alter table public.clothing_items       enable row level security;
alter table public.outfits              enable row level security;
alter table public.outfit_items         enable row level security;
alter table public.wear_log             enable row level security;
alter table public.wishlist_suggestions enable row level security;

create policy "own profile" on public.users
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "own clothing items" on public.clothing_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own outfits" on public.outfits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own wishlist" on public.wishlist_suggestions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- outfit_items has no user_id, so ownership is checked through the parent
-- outfit AND the clothing item (you can't link someone else's clothes).
create policy "own outfit items" on public.outfit_items
  for all to authenticated
  using (exists (
    select 1 from public.outfits o
    where o.id = outfit_id and o.user_id = (select auth.uid())
  ))
  with check (
    exists (select 1 from public.outfits o
            where o.id = outfit_id and o.user_id = (select auth.uid()))
    and exists (select 1 from public.clothing_items c
                where c.id = clothing_item_id and c.user_id = (select auth.uid()))
  );

create policy "own wear log" on public.wear_log
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.clothing_items c
                where c.id = clothing_item_id and c.user_id = (select auth.uid()))
  );


-- =====================================================================
-- 5. PHOTO STORAGE: private bucket, one folder per user
--    Files must be uploaded to  <user_id>/<filename>
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('clothing-images', 'clothing-images', false);

create policy "read own images" on storage.objects
  for select to authenticated
  using (bucket_id = 'clothing-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "upload own images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'clothing-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "update own images" on storage.objects
  for update to authenticated
  using (bucket_id = 'clothing-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "delete own images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'clothing-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);


-- =====================================================================
-- 5b. CHANGES AFTER THE INITIAL SETUP
--     Each block is safe to re-run ("if not exists"). On a project where
--     sections 1-5 already ran, paste ONLY these blocks into the SQL Editor.
-- =====================================================================

-- Step 4: the AI's short explanation of why it picked an outfit, shown on
-- the Today screen.
alter table public.outfits add column if not exists ai_reason text;

-- Richer item identification: a specific title (e.g. a recognized band tour
-- tee or team logo) instead of just category + color.
alter table public.clothing_items add column if not exists title text;


-- =====================================================================
-- 6. HOW TO TEST ROW LEVEL SECURITY (manual; leave commented out)
--
-- WHY A SPECIAL RECIPE: the SQL Editor runs as the privileged "postgres"
-- role, which BYPASSES RLS, so a plain "select * from clothing_items"
-- there always shows everything and proves nothing. Instead, inside a
-- transaction we (1) "set local role authenticated", which drops to the
-- same unprivileged role the app uses, so RLS is enforced, and (2) set
-- request.jwt.claims, which is what auth.uid() reads, to pretend to be a
-- specific test user. Changing the claim mid-transaction switches user.
-- "local" and the final rollback mean nothing persists.
--
-- Setup: Authentication -> Users -> Add user, create two test users
-- (e.g. a@test.com and b@test.com). Confirm both got a row in
-- public.users (that proves the sign-up trigger works). Copy their ids
-- and replace A_UUID / B_UUID below. Run the block in the SQL Editor.
-- Everything is inside a transaction and rolled back, so nothing is kept.
--
-- begin;
-- set local role authenticated;   -- behave like a logged-in app user
--
-- -- Act as user A: insert one item and one wear-log entry
-- select set_config('request.jwt.claims',
--   '{"sub":"A_UUID","role":"authenticated"}', true);
-- insert into public.clothing_items (user_id, category, image_url)
--   values ('A_UUID', 't_shirt', 'A_UUID/test.jpg');
-- insert into public.wear_log (user_id, clothing_item_id)
--   select 'A_UUID', id from public.clothing_items;
-- select count(*) from public.clothing_items;   -- expect 1
-- select count(*) from public.wear_log;         -- expect 1
--
-- -- Switch to user B: must see nothing of A's
-- select set_config('request.jwt.claims',
--   '{"sub":"B_UUID","role":"authenticated"}', true);
-- select count(*) from public.clothing_items;   -- expect 0
-- select count(*) from public.wear_log;         -- expect 0
--
-- -- B tries to write a row owned by A: must fail with
-- -- "new row violates row-level security policy"
-- insert into public.clothing_items (user_id, category, image_url)
--   values ('A_UUID', 'shirt', 'A_UUID/hack.jpg');
--
-- rollback;
--
-- (After the failing insert the transaction aborts; that is expected.
--  Run "rollback;" to clean up.) Optionally also try the Storage tab:
--  as B, uploading to a folder named A_UUID should be rejected.
-- =====================================================================

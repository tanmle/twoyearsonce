-- BeerCup shared-data starter schema.
-- Run this in Supabase SQL editor. Do not put the database password in frontend code.

create table if not exists public.players (
  id text primary key,
  name text not null,
  avatar text not null,
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.players
  add column if not exists role text not null default 'player' check (role in ('player', 'admin'));

create table if not exists public.matches (
  id text primary key,
  external_id text unique,
  league text not null,
  home_team text not null,
  away_team text not null,
  home_logo text not null,
  away_logo text not null,
  handicap numeric not null default 0,
  handicap_is_manual boolean not null default false,
  kickoff_at timestamptz,
  display_time text not null,
  display_date text not null,
  stadium text not null,
  status text not null check (status in ('UPCOMING', 'LIVE', 'FINISHED')),
  home_goals integer,
  away_goals integer,
  home_scorers text[] not null default '{}',
  away_scorers text[] not null default '{}',
  live_time_text text,
  is_hot boolean not null default false,
  last_synced_at timestamptz not null default now(),
  odds_updated_at timestamptz,
  match_type text,
  match_group text
);

alter table public.matches
  add column if not exists handicap_is_manual boolean not null default false;

alter table public.matches
  add column if not exists home_scorers text[] not null default '{}',
  add column if not exists away_scorers text[] not null default '{}',
  add column if not exists match_type text,
  add column if not exists match_group text;

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  choice text not null check (choice in ('HOME', 'AWAY')),
  hope_star boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

alter table public.predictions
  add column if not exists hope_star boolean not null default false;

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  status text not null check (status in ('WIN', 'LOSE_HALF', 'LOSE', 'LOSE_DOUBLE')),
  penalty_vnd integer not null default 0,
  settled_at timestamptz not null default now(),
  unique (prediction_id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  player_id text references public.players(id) on delete set null,
  player_name text not null,
  action_text text not null,
  target_text text,
  type text not null check (type in ('change_prediction', 'penalty', 'join_prediction')),
  status_type text check (status_type in ('LOSE_DOUBLE', 'LOSE_HALF', 'LOSE', 'WIN')),
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.settlements enable row level security;
alter table public.activities enable row level security;

-- Public read for early friend-league prototype.
-- PostgreSQL does not support CREATE POLICY IF NOT EXISTS, so drop/recreate for repeatable setup.
drop policy if exists "public read players" on public.players;
drop policy if exists "public read matches" on public.matches;
drop policy if exists "public read predictions" on public.predictions;
drop policy if exists "public read settlements" on public.settlements;
drop policy if exists "public read activities" on public.activities;
drop policy if exists "public write players" on public.players;
drop policy if exists "public write matches" on public.matches;
drop policy if exists "public update matches" on public.matches;
drop policy if exists "public write predictions" on public.predictions;
drop policy if exists "public update predictions" on public.predictions;
drop policy if exists "public write settlements" on public.settlements;
drop policy if exists "public update settlements" on public.settlements;
drop policy if exists "public write activities" on public.activities;

create policy "public read players" on public.players for select using (true);
create policy "public read matches" on public.matches for select using (true);
create policy "public read predictions" on public.predictions for select using (true);
create policy "public read settlements" on public.settlements for select using (true);
create policy "public read activities" on public.activities for select using (true);

-- Prototype writes. Tighten once auth/player ownership is implemented.
create policy "public write players" on public.players for insert with check (true);
create policy "public write matches" on public.matches for insert with check (true);
create policy "public update matches" on public.matches for update using (true) with check (true);
create policy "public write predictions" on public.predictions for insert with check (true);
create policy "public update predictions" on public.predictions for update using (true) with check (true);
create policy "public write settlements" on public.settlements for insert with check (true);
create policy "public update settlements" on public.settlements for update using (true) with check (true);
create policy "public write activities" on public.activities for insert with check (true);

create extension if not exists "pgcrypto";

create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.lore_files (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  folder text not null,
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  difficulty text not null default 'normal' check (difficulty in ('easy', 'normal', 'hard')),
  is_pvp_enabled boolean not null default false,
  current_plot_stage text,
  active_player_id uuid,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  race text not null,
  class text not null,
  appearance text not null default '',
  personality jsonb not null default '{}'::jsonb,
  bio text not null default '',
  power_level integer not null default 10,
  stats jsonb not null default '{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10}'::jsonb,
  hp integer not null,
  max_hp integer not null,
  money integer not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, user_id),
  check (hp >= 0),
  check (max_hp > 0),
  check (money >= 0)
);

alter table public.sessions
  add constraint sessions_active_player_id_fkey foreign key (active_player_id) references public.players(id) on delete set null;

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  item_name text not null,
  quantity integer not null default 1,
  type text not null check (type in ('weapon', 'armor', 'consumable', 'misc')),
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (quantity > 0)
);

create table public.master_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  content text not null,
  strict_facts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index lore_files_world_tags_idx on public.lore_files using gin(tags);
create index inventory_player_item_idx on public.inventory(player_id, item_name);
create index master_messages_session_created_idx on public.master_messages(session_id, created_at);

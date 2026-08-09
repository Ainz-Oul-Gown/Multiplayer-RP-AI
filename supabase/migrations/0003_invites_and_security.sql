create table public.session_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid references auth.users(id) on delete cascade,
  invite_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

create index session_invites_invitee_status_idx on public.session_invites(invitee_id, status);
create index session_invites_session_status_idx on public.session_invites(session_id, status);

alter table public.worlds enable row level security;
alter table public.lore_files enable row level security;
alter table public.sessions enable row level security;
alter table public.players enable row level security;
alter table public.inventory enable row level security;
alter table public.master_messages enable row level security;
alter table public.turn_events enable row level security;
alter table public.session_invites enable row level security;

create policy "world owners can manage worlds" on public.worlds
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "world owners can manage lore" on public.lore_files
  for all using (exists (select 1 from public.worlds where worlds.id = lore_files.world_id and worlds.owner_id = auth.uid()))
  with check (exists (select 1 from public.worlds where worlds.id = lore_files.world_id and worlds.owner_id = auth.uid()));

create policy "session members can read sessions" on public.sessions
  for select using (owner_id = auth.uid() or exists (select 1 from public.players where players.session_id = sessions.id and players.user_id = auth.uid()));

create policy "session owners can update sessions" on public.sessions
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "session owners can create sessions" on public.sessions
  for insert with check (owner_id = auth.uid());

create policy "players can read party" on public.players
  for select using (user_id = auth.uid() or exists (select 1 from public.sessions where sessions.id = players.session_id and sessions.owner_id = auth.uid()));

create policy "players can manage own sheet" on public.players
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "players can read own inventory" on public.inventory
  for select using (exists (select 1 from public.players where players.id = inventory.player_id and players.user_id = auth.uid()));

create policy "players can read session master messages" on public.master_messages
  for select using (exists (select 1 from public.players where players.session_id = master_messages.session_id and players.user_id = auth.uid()));

create policy "players can read own turn events" on public.turn_events
  for select using (exists (select 1 from public.players where players.id = turn_events.player_id and players.user_id = auth.uid()));

create policy "invite participants can read invites" on public.session_invites
  for select using (inviter_id = auth.uid() or invitee_id = auth.uid());

create policy "session owners can create invites" on public.session_invites
  for insert with check (inviter_id = auth.uid() and exists (select 1 from public.sessions where sessions.id = session_invites.session_id and sessions.owner_id = auth.uid()));

create policy "invite participants can update invites" on public.session_invites
  for update using (inviter_id = auth.uid() or invitee_id = auth.uid()) with check (inviter_id = auth.uid() or invitee_id = auth.uid());

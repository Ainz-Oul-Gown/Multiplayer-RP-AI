create table public.turn_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  action_text text not null,
  parsed_action jsonb not null,
  dice_result jsonb not null default '{}'::jsonb,
  strict_facts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index turn_events_session_created_idx on public.turn_events(session_id, created_at);

create or replace function public.resolve_skill_check(
  input_session_id uuid,
  input_player_id uuid,
  ability text,
  difficulty_class integer,
  action_text text,
  parsed_action jsonb
)
returns table (dice_result jsonb, strict_facts jsonb)
language plpgsql
security definer
as $$
declare
  player_row public.players%rowtype;
  session_row public.sessions%rowtype;
  raw_roll integer;
  second_roll integer;
  kept_roll integer;
  modifier integer;
  total integer;
  success boolean;
  facts jsonb;
begin
  select * into player_row from public.players where id = input_player_id and session_id = input_session_id for update;
  if not found then
    raise exception 'player not found in session';
  end if;

  select * into session_row from public.sessions where id = input_session_id for update;
  if not found then
    raise exception 'session not found';
  end if;

  raw_roll := floor(random() * 20 + 1)::integer;
  second_roll := case when session_row.difficulty = 'normal' then raw_roll else floor(random() * 20 + 1)::integer end;
  kept_roll := case
    when session_row.difficulty = 'easy' then greatest(raw_roll, second_roll)
    when session_row.difficulty = 'hard' then least(raw_roll, second_roll)
    else raw_roll
  end;
  modifier := coalesce((player_row.stats ->> ability)::integer, 0);
  total := kept_roll + modifier;
  success := total >= difficulty_class;

  dice_result := jsonb_build_object(
    'roll', raw_roll,
    'secondRoll', second_roll,
    'keptRoll', kept_roll,
    'modifier', modifier,
    'total', total,
    'difficulty', difficulty_class,
    'success', success,
    'mode', session_row.difficulty
  );
  facts := jsonb_build_array(format('Проверка навыка [%s]: %s (Бросок %s + модификатор %s = %s, нужно %s).', ability, case when success then 'УСПЕХ' else 'ПРОВАЛ' end, kept_roll, modifier, total, difficulty_class));
  strict_facts := facts;

  insert into public.turn_events(session_id, player_id, action_text, parsed_action, dice_result, strict_facts)
  values (input_session_id, input_player_id, action_text, parsed_action, dice_result, strict_facts);

  return next;
end;
$$;

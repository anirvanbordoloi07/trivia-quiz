create extension if not exists pgcrypto;

create schema if not exists trivia;

create type trivia.game_status as enum (
  'lobby',
  'authoring',
  'answering',
  'reveal',
  'completed',
  'abandoned'
);

create type trivia.player_role as enum (
  'player1',
  'player2'
);

create type trivia.round_status as enum (
  'pending',
  'answering',
  'revealed',
  'scored'
);

create table trivia.games (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  status trivia.game_status not null default 'lobby',
  questions_per_player integer not null check (questions_per_player in (5, 10, 15)),
  total_rounds integer not null check (total_rounds in (10, 20, 30)),
  current_round_number integer not null default 1,
  current_questioner_role trivia.player_role,
  current_answerer_role trivia.player_role,
  winner_role trivia.player_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  answer_deadline_at timestamptz,
  reveal_deadline_at timestamptz
);

create table trivia.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references trivia.games(id) on delete cascade,
  role trivia.player_role not null,
  player_token uuid not null default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 50),
  score integer not null default 0,
  connected boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (game_id, role),
  unique (game_id, player_token)
);

create table trivia.game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references trivia.games(id) on delete cascade,
  round_number integer not null,
  questioner_role trivia.player_role not null,
  answerer_role trivia.player_role not null,
  question_text text not null check (char_length(question_text) between 1 and 300),
  choice_a text not null check (char_length(choice_a) between 1 and 150),
  choice_b text not null check (char_length(choice_b) between 1 and 150),
  choice_c text not null check (char_length(choice_c) between 1 and 150),
  choice_d text not null check (char_length(choice_d) between 1 and 150),
  correct_choice text not null check (correct_choice in ('A', 'B', 'C', 'D')),
  submitted_choice text check (submitted_choice in ('A', 'B', 'C', 'D')),
  timed_out boolean not null default false,
  answerer_correct boolean,
  score_awarded_to trivia.player_role,
  status trivia.round_status not null default 'pending',
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  revealed_at timestamptz,
  unique (game_id, round_number)
);

create table trivia.game_events (
  id bigint generated always as identity primary key,
  game_id uuid not null references trivia.games(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index game_players_game_id_idx on trivia.game_players(game_id);
create index game_rounds_game_id_idx on trivia.game_rounds(game_id);
create index game_rounds_game_round_idx on trivia.game_rounds(game_id, round_number);
create index game_events_game_id_idx on trivia.game_events(game_id);

create or replace function trivia.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on trivia.games;
create trigger games_set_updated_at
before update on trivia.games
for each row
execute function trivia.set_updated_at();

create or replace function trivia.generate_join_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 8);
    exit when not exists (
      select 1 from trivia.games where join_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function trivia.log_event(
  p_game_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language sql
as $$
  insert into trivia.game_events (game_id, event_type, payload)
  values (p_game_id, p_event_type, coalesce(p_payload, '{}'::jsonb));
$$;

create or replace function trivia.create_game(
  p_display_name text,
  p_questions_per_player integer
)
returns jsonb
language plpgsql
as $$
declare
  v_game_id uuid;
  v_player_id uuid;
  v_player_token uuid;
  v_join_code text;
begin
  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'Display name is required.';
  end if;

  if p_questions_per_player not in (5, 10, 15) then
    raise exception 'questions_per_player must be 5, 10, or 15.';
  end if;

  v_join_code := trivia.generate_join_code();

  insert into trivia.games (
    join_code,
    questions_per_player,
    total_rounds,
    current_questioner_role,
    current_answerer_role
  )
  values (
    v_join_code,
    p_questions_per_player,
    p_questions_per_player * 2,
    'player1',
    'player2'
  )
  returning id into v_game_id;

  insert into trivia.game_players (
    game_id,
    role,
    display_name
  )
  values (
    v_game_id,
    'player1',
    left(btrim(p_display_name), 50)
  )
  returning id, player_token into v_player_id, v_player_token;

  perform trivia.log_event(
    v_game_id,
    'game_created',
    jsonb_build_object('player_role', 'player1', 'display_name', left(btrim(p_display_name), 50))
  );

  return jsonb_build_object(
    'game_id', v_game_id,
    'join_code', v_join_code,
    'player_id', v_player_id,
    'player_role', 'player1',
    'player_token', v_player_token,
    'questions_per_player', p_questions_per_player
  );
end;
$$;

create or replace function trivia.join_game(
  p_join_code text,
  p_display_name text
)
returns jsonb
language plpgsql
as $$
declare
  v_game trivia.games%rowtype;
  v_player_id uuid;
  v_player_token uuid;
begin
  if p_join_code is null or btrim(p_join_code) = '' then
    raise exception 'Join code is required.';
  end if;

  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'Display name is required.';
  end if;

  select *
  into v_game
  from trivia.games
  where join_code = upper(btrim(p_join_code));

  if not found then
    raise exception 'Game not found.';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'Game is not joinable.';
  end if;

  if exists (
    select 1
    from trivia.game_players
    where game_id = v_game.id
      and role = 'player2'
  ) then
    raise exception 'Game is already full.';
  end if;

  insert into trivia.game_players (
    game_id,
    role,
    display_name
  )
  values (
    v_game.id,
    'player2',
    left(btrim(p_display_name), 50)
  )
  returning id, player_token into v_player_id, v_player_token;

  perform trivia.log_event(
    v_game.id,
    'player_joined',
    jsonb_build_object('player_role', 'player2', 'display_name', left(btrim(p_display_name), 50))
  );

  return jsonb_build_object(
    'game_id', v_game.id,
    'join_code', v_game.join_code,
    'player_id', v_player_id,
    'player_role', 'player2',
    'player_token', v_player_token,
    'questions_per_player', v_game.questions_per_player
  );
end;
$$;

create or replace function trivia.resume_player(
  p_game_id uuid,
  p_player_token uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_game trivia.games%rowtype;
  v_player trivia.game_players%rowtype;
begin
  select * into v_game
  from trivia.games
  where id = p_game_id;

  if not found then
    raise exception 'Game not found.';
  end if;

  select * into v_player
  from trivia.game_players
  where game_id = p_game_id
    and player_token = p_player_token;

  if not found then
    raise exception 'Player not found for this game.';
  end if;

  update trivia.game_players
  set connected = true,
      last_seen_at = now()
  where id = v_player.id;

  return jsonb_build_object(
    'game', row_to_json(v_game),
    'player', row_to_json(v_player),
    'players', (
      select jsonb_agg(row_to_json(gp))
      from trivia.game_players gp
      where gp.game_id = p_game_id
      order by gp.role
    ),
    'current_round', (
      select to_jsonb(gr)
      from trivia.game_rounds gr
      where gr.game_id = p_game_id
      order by gr.round_number desc
      limit 1
    )
  );
end;
$$;

alter publication supabase_realtime add table trivia.games;
alter publication supabase_realtime add table trivia.game_players;
alter publication supabase_realtime add table trivia.game_rounds;

grant usage on schema trivia to anon, authenticated;
grant select on trivia.games, trivia.game_players, trivia.game_rounds, trivia.game_events to anon, authenticated;
grant execute on function trivia.create_game(text, integer) to anon, authenticated;
grant execute on function trivia.join_game(text, text) to anon, authenticated;
grant execute on function trivia.resume_player(uuid, uuid) to anon, authenticated;

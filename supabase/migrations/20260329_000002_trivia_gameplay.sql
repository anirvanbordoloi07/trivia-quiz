create or replace function trivia.get_game_snapshot(
  p_game_id uuid,
  p_player_token uuid default null
)
returns jsonb
language sql
as $$
  with g as (
    select *
    from trivia.games
    where id = p_game_id
  ),
  me as (
    select gp.*
    from trivia.game_players gp
    where gp.game_id = p_game_id
      and (p_player_token is null or gp.player_token = p_player_token)
    order by gp.role
    limit 1
  ),
  players as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', gp.id,
          'role', gp.role,
          'display_name', gp.display_name,
          'score', gp.score,
          'player_token', gp.player_token,
          'connected', gp.connected,
          'last_seen_at', gp.last_seen_at
        )
        order by gp.role
      ),
      '[]'::jsonb
    ) as value
    from trivia.game_players gp
    where gp.game_id = p_game_id
  ),
  rounds as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', gr.id,
          'round_number', gr.round_number,
          'questioner_role', gr.questioner_role,
          'answerer_role', gr.answerer_role,
          'question_text', gr.question_text,
          'choice_a', gr.choice_a,
          'choice_b', gr.choice_b,
          'choice_c', gr.choice_c,
          'choice_d', gr.choice_d,
          'correct_choice', gr.correct_choice,
          'submitted_choice', gr.submitted_choice,
          'timed_out', gr.timed_out,
          'answerer_correct', gr.answerer_correct,
          'score_awarded_to', gr.score_awarded_to,
          'status', gr.status,
          'created_at', gr.created_at,
          'answered_at', gr.answered_at,
          'revealed_at', gr.revealed_at
        )
        order by gr.round_number
      ),
      '[]'::jsonb
    ) as value
    from trivia.game_rounds gr
    where gr.game_id = p_game_id
  ),
  current_round as (
    select to_jsonb(gr.*) as value
    from trivia.game_rounds gr
    join g on g.current_round_number = gr.round_number and g.id = gr.game_id
    limit 1
  )
  select jsonb_build_object(
    'game', (select row_to_json(g) from g),
    'player', (select row_to_json(me) from me),
    'players', (select value from players),
    'rounds', (select value from rounds),
    'current_round', coalesce((select value from current_round), 'null'::jsonb)
  );
$$;

create or replace function trivia.join_game_by_id(
  p_game_id uuid,
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
  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'Display name is required.';
  end if;

  select *
  into v_game
  from trivia.games
  where id = p_game_id;

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
  v_player trivia.game_players%rowtype;
begin
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

  return trivia.get_game_snapshot(p_game_id, p_player_token);
end;
$$;

create or replace function trivia.start_game(
  p_game_id uuid,
  p_player_token uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_player trivia.game_players%rowtype;
  v_game trivia.games%rowtype;
begin
  select * into v_player
  from trivia.game_players
  where game_id = p_game_id
    and player_token = p_player_token;

  if not found then
    raise exception 'Player not found.';
  end if;

  if v_player.role <> 'player1' then
    raise exception 'Only player1 can start the game.';
  end if;

  select * into v_game
  from trivia.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'Game has already started.';
  end if;

  if (select count(*) from trivia.game_players where game_id = p_game_id) <> 2 then
    raise exception 'Two players are required to start.';
  end if;

  update trivia.games
  set status = 'authoring',
      current_round_number = 1,
      current_questioner_role = 'player1',
      current_answerer_role = 'player2',
      started_at = coalesce(started_at, now()),
      answer_deadline_at = null,
      reveal_deadline_at = null
  where id = p_game_id;

  perform trivia.log_event(p_game_id, 'game_started');

  return trivia.get_game_snapshot(p_game_id, p_player_token);
end;
$$;

create or replace function trivia.submit_question(
  p_game_id uuid,
  p_player_token uuid,
  p_question_text text,
  p_choice_a text,
  p_choice_b text,
  p_choice_c text,
  p_choice_d text,
  p_correct_choice text
)
returns jsonb
language plpgsql
as $$
declare
  v_player trivia.game_players%rowtype;
  v_game trivia.games%rowtype;
begin
  select * into v_player
  from trivia.game_players
  where game_id = p_game_id
    and player_token = p_player_token;

  if not found then
    raise exception 'Player not found.';
  end if;

  select * into v_game
  from trivia.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  if v_game.status <> 'authoring' then
    raise exception 'Not in authoring phase.';
  end if;

  if v_player.role <> v_game.current_questioner_role then
    raise exception 'It is not your turn to ask.';
  end if;

  if p_correct_choice not in ('A', 'B', 'C', 'D') then
    raise exception 'Correct choice must be A, B, C, or D.';
  end if;

  insert into trivia.game_rounds (
    game_id,
    round_number,
    questioner_role,
    answerer_role,
    question_text,
    choice_a,
    choice_b,
    choice_c,
    choice_d,
    correct_choice,
    status
  )
  values (
    p_game_id,
    v_game.current_round_number,
    v_game.current_questioner_role,
    v_game.current_answerer_role,
    left(btrim(p_question_text), 300),
    left(btrim(p_choice_a), 150),
    left(btrim(p_choice_b), 150),
    left(btrim(p_choice_c), 150),
    left(btrim(p_choice_d), 150),
    p_correct_choice,
    'answering'
  )
  on conflict (game_id, round_number)
  do update set
    questioner_role = excluded.questioner_role,
    answerer_role = excluded.answerer_role,
    question_text = excluded.question_text,
    choice_a = excluded.choice_a,
    choice_b = excluded.choice_b,
    choice_c = excluded.choice_c,
    choice_d = excluded.choice_d,
    correct_choice = excluded.correct_choice,
    submitted_choice = null,
    timed_out = false,
    answerer_correct = null,
    score_awarded_to = null,
    status = 'answering',
    answered_at = null,
    revealed_at = null;

  update trivia.games
  set status = 'answering',
      answer_deadline_at = now() + interval '30 seconds',
      reveal_deadline_at = null
  where id = p_game_id;

  perform trivia.log_event(
    p_game_id,
    'question_submitted',
    jsonb_build_object('round_number', v_game.current_round_number)
  );

  return trivia.get_game_snapshot(p_game_id, p_player_token);
end;
$$;

create or replace function trivia.submit_answer(
  p_game_id uuid,
  p_player_token uuid,
  p_choice text
)
returns jsonb
language plpgsql
as $$
declare
  v_player trivia.game_players%rowtype;
  v_game trivia.games%rowtype;
  v_round trivia.game_rounds%rowtype;
  v_correct boolean;
begin
  select * into v_player
  from trivia.game_players
  where game_id = p_game_id
    and player_token = p_player_token;

  if not found then
    raise exception 'Player not found.';
  end if;

  select * into v_game
  from trivia.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  if v_game.status <> 'answering' then
    raise exception 'Not in answering phase.';
  end if;

  if v_player.role <> v_game.current_answerer_role then
    raise exception 'It is not your turn to answer.';
  end if;

  if p_choice not in ('A', 'B', 'C', 'D') then
    raise exception 'Answer choice must be A, B, C, or D.';
  end if;

  if v_game.answer_deadline_at is not null and now() > v_game.answer_deadline_at then
    raise exception 'Answer deadline has passed.';
  end if;

  select * into v_round
  from trivia.game_rounds
  where game_id = p_game_id
    and round_number = v_game.current_round_number
  for update;

  if not found then
    raise exception 'No active round found.';
  end if;

  if v_round.submitted_choice is not null then
    raise exception 'Answer already submitted.';
  end if;

  v_correct := (v_round.correct_choice = p_choice);

  update trivia.game_rounds
  set submitted_choice = p_choice,
      timed_out = false,
      answerer_correct = v_correct,
      score_awarded_to = case when v_correct then v_game.current_answerer_role else v_game.current_questioner_role end,
      status = 'revealed',
      answered_at = now(),
      revealed_at = now()
  where id = v_round.id;

  update trivia.game_players
  set score = score + 1
  where game_id = p_game_id
    and role = case when v_correct then v_game.current_answerer_role else v_game.current_questioner_role end;

  update trivia.games
  set status = 'reveal',
      reveal_deadline_at = now() + interval '5 seconds',
      answer_deadline_at = null
  where id = p_game_id;

  perform trivia.log_event(
    p_game_id,
    'answer_submitted',
    jsonb_build_object('round_number', v_game.current_round_number, 'answer', p_choice, 'correct', v_correct)
  );

  return trivia.get_game_snapshot(p_game_id, p_player_token);
end;
$$;

create or replace function trivia.submit_timeout(
  p_game_id uuid,
  p_player_token uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_player trivia.game_players%rowtype;
  v_game trivia.games%rowtype;
  v_round trivia.game_rounds%rowtype;
begin
  select * into v_player
  from trivia.game_players
  where game_id = p_game_id
    and player_token = p_player_token;

  if not found then
    raise exception 'Player not found.';
  end if;

  select * into v_game
  from trivia.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  if v_game.status <> 'answering' then
    return trivia.get_game_snapshot(p_game_id, p_player_token);
  end if;

  if v_game.answer_deadline_at is not null and now() < v_game.answer_deadline_at then
    raise exception 'Answer deadline has not passed yet.';
  end if;

  select * into v_round
  from trivia.game_rounds
  where game_id = p_game_id
    and round_number = v_game.current_round_number
  for update;

  if not found then
    raise exception 'No active round found.';
  end if;

  if v_round.submitted_choice is not null or v_round.timed_out then
    return trivia.get_game_snapshot(p_game_id, p_player_token);
  end if;

  update trivia.game_rounds
  set submitted_choice = null,
      timed_out = true,
      answerer_correct = false,
      score_awarded_to = v_game.current_questioner_role,
      status = 'revealed',
      answered_at = now(),
      revealed_at = now()
  where id = v_round.id;

  update trivia.game_players
  set score = score + 1
  where game_id = p_game_id
    and role = v_game.current_questioner_role;

  update trivia.games
  set status = 'reveal',
      reveal_deadline_at = now() + interval '5 seconds',
      answer_deadline_at = null
  where id = p_game_id;

  perform trivia.log_event(
    p_game_id,
    'answer_timed_out',
    jsonb_build_object('round_number', v_game.current_round_number)
  );

  return trivia.get_game_snapshot(p_game_id, p_player_token);
end;
$$;

create or replace function trivia.advance_round(
  p_game_id uuid,
  p_player_token uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_player trivia.game_players%rowtype;
  v_game trivia.games%rowtype;
  v_next_questioner trivia.player_role;
  v_next_answerer trivia.player_role;
begin
  select * into v_player
  from trivia.game_players
  where game_id = p_game_id
    and player_token = p_player_token;

  if not found then
    raise exception 'Player not found.';
  end if;

  select * into v_game
  from trivia.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  if v_game.status <> 'reveal' then
    raise exception 'Round is not ready to advance.';
  end if;

  if v_game.reveal_deadline_at is not null and now() < v_game.reveal_deadline_at then
    raise exception 'Reveal countdown is still running.';
  end if;

  update trivia.game_rounds
  set status = 'scored'
  where game_id = p_game_id
    and round_number = v_game.current_round_number
    and status <> 'scored';

  if v_game.current_round_number >= v_game.total_rounds then
    update trivia.games
    set status = 'completed',
        completed_at = now(),
        winner_role = (
          select case
            when max(case when role = 'player1' then score end) > max(case when role = 'player2' then score end) then 'player1'::trivia.player_role
            when max(case when role = 'player2' then score end) > max(case when role = 'player1' then score end) then 'player2'::trivia.player_role
            else null
          end
          from trivia.game_players
          where game_id = p_game_id
        ),
        answer_deadline_at = null,
        reveal_deadline_at = null
    where id = p_game_id;

    perform trivia.log_event(p_game_id, 'game_completed');
    return trivia.get_game_snapshot(p_game_id, p_player_token);
  end if;

  v_next_questioner := v_game.current_answerer_role;
  v_next_answerer := v_game.current_questioner_role;

  update trivia.games
  set status = 'authoring',
      current_round_number = current_round_number + 1,
      current_questioner_role = v_next_questioner,
      current_answerer_role = v_next_answerer,
      answer_deadline_at = null,
      reveal_deadline_at = null
  where id = p_game_id;

  perform trivia.log_event(
    p_game_id,
    'round_advanced',
    jsonb_build_object('round_number', v_game.current_round_number + 1)
  );

  return trivia.get_game_snapshot(p_game_id, p_player_token);
end;
$$;

create or replace function trivia.mark_player_disconnected(
  p_game_id uuid,
  p_player_token uuid
)
returns void
language sql
as $$
  update trivia.game_players
  set connected = false,
      last_seen_at = now()
  where game_id = p_game_id
    and player_token = p_player_token;
$$;

grant execute on function trivia.get_game_snapshot(uuid, uuid) to anon, authenticated;
grant execute on function trivia.join_game_by_id(uuid, text) to anon, authenticated;
grant execute on function trivia.start_game(uuid, uuid) to anon, authenticated;
grant execute on function trivia.submit_question(uuid, uuid, text, text, text, text, text, text) to anon, authenticated;
grant execute on function trivia.submit_answer(uuid, uuid, text) to anon, authenticated;
grant execute on function trivia.submit_timeout(uuid, uuid) to anon, authenticated;
grant execute on function trivia.advance_round(uuid, uuid) to anon, authenticated;
grant execute on function trivia.mark_player_disconnected(uuid, uuid) to anon, authenticated;

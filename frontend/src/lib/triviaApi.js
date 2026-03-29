import supabase from './supabase'

export const PLAYER_SESSION_STORAGE_KEY = 'trivia-duel-player-session'

function unwrapRpc(result, fallbackMessage) {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage)
  }
  return result.data
}

export function savePlayerSession(session) {
  localStorage.setItem(PLAYER_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function loadPlayerSession() {
  try {
    const raw = localStorage.getItem(PLAYER_SESSION_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearPlayerSession() {
  localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY)
}

export async function createGame(displayName, questionsPerPlayer) {
  const result = await supabase.schema('trivia').rpc('create_game', {
    p_display_name: displayName,
    p_questions_per_player: questionsPerPlayer,
  })

  return unwrapRpc(result, 'Failed to create game.')
}

export async function joinGameById(gameId, displayName) {
  const result = await supabase.schema('trivia').rpc('join_game_by_id', {
    p_game_id: gameId,
    p_display_name: displayName,
  })

  return unwrapRpc(result, 'Failed to join game.')
}

export async function resumePlayer(gameId, playerToken) {
  const result = await supabase.schema('trivia').rpc('resume_player', {
    p_game_id: gameId,
    p_player_token: playerToken,
  })

  return unwrapRpc(result, 'Failed to resume player.')
}

export async function getGameSnapshot(gameId, playerToken) {
  const result = await supabase.schema('trivia').rpc('get_game_snapshot', {
    p_game_id: gameId,
    p_player_token: playerToken,
  })

  return unwrapRpc(result, 'Failed to load game snapshot.')
}

export async function startGame(gameId, playerToken) {
  const result = await supabase.schema('trivia').rpc('start_game', {
    p_game_id: gameId,
    p_player_token: playerToken,
  })

  return unwrapRpc(result, 'Failed to start game.')
}

export async function submitQuestion(gameId, playerToken, payload) {
  const result = await supabase.schema('trivia').rpc('submit_question', {
    p_game_id: gameId,
    p_player_token: playerToken,
    p_question_text: payload.question,
    p_choice_a: payload.choices.A,
    p_choice_b: payload.choices.B,
    p_choice_c: payload.choices.C,
    p_choice_d: payload.choices.D,
    p_correct_choice: payload.correctAnswer,
  })

  return unwrapRpc(result, 'Failed to submit question.')
}

export async function submitAnswer(gameId, playerToken, answer) {
  const result = await supabase.schema('trivia').rpc('submit_answer', {
    p_game_id: gameId,
    p_player_token: playerToken,
    p_choice: answer,
  })

  return unwrapRpc(result, 'Failed to submit answer.')
}

export async function submitTimeout(gameId, playerToken) {
  const result = await supabase.schema('trivia').rpc('submit_timeout', {
    p_game_id: gameId,
    p_player_token: playerToken,
  })

  return unwrapRpc(result, 'Failed to submit timeout.')
}

export async function advanceRound(gameId, playerToken) {
  const result = await supabase.schema('trivia').rpc('advance_round', {
    p_game_id: gameId,
    p_player_token: playerToken,
  })

  return unwrapRpc(result, 'Failed to advance round.')
}

export async function markPlayerDisconnected(gameId, playerToken) {
  const result = await supabase.schema('trivia').rpc('mark_player_disconnected', {
    p_game_id: gameId,
    p_player_token: playerToken,
  })

  return unwrapRpc(result, 'Failed to mark player disconnected.')
}

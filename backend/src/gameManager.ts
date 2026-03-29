import { nanoid } from 'nanoid';
import {
  GameState,
  GameLength,
  GameStateStatus,
  AnswerChoice,
  PlayerState,
  RoundRecord,
} from './types';

// In-memory store: gameId → GameState
const games = new Map<string, GameState>();

// ── Utility ───────────────────────────────────────────────────────────────────

/** Sanitize user-supplied text: strip HTML tags, trim, truncate */
export function sanitize(input: unknown, maxLength = 300): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')   // strip HTML tags
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // remove control chars
    .trim()
    .slice(0, maxLength);
}

/** Validate that a value is one of the four answer choices */
export function isValidChoice(val: unknown): val is AnswerChoice {
  return val === 'A' || val === 'B' || val === 'C' || val === 'D';
}

/** Validate game length */
export function isValidGameLength(val: unknown): val is GameLength {
  return val === 5 || val === 10 || val === 15;
}

// ── Game lifecycle ─────────────────────────────────────────────────────────────

export function createGame(socketId: string, playerName: string, gameLength: GameLength): GameState {
  const gameId = nanoid(8);
  const game: GameState = {
    gameId,
    gameLength,
    totalRounds: gameLength * 2,
    currentRound: 0,
    state: 'WAITING_FOR_P2',
    players: {
      [socketId]: {
        name: sanitize(playerName, 50),
        score: 0,
        isPlayer1: true,
      },
    },
    currentQuestioner: socketId,
    currentAnswerer: '',
    rounds: [],
    lastQuestionAt: {},
    lastActivityAt: Date.now(),
  };
  games.set(gameId, game);
  return game;
}

export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId);
}

export function deleteGame(gameId: string): void {
  games.delete(gameId);
}

/** Add Player 2 to an existing game. Returns error string or null. */
export function joinGame(
  gameId: string,
  socketId: string,
  playerName: string
): { game: GameState; error?: string } {
  const game = games.get(gameId);
  if (!game) return { game: null as any, error: 'Game not found.' };
  if (game.state !== 'WAITING_FOR_P2') return { game, error: 'Game is not accepting players.' };
  if (Object.keys(game.players).length >= 2) return { game, error: 'Game is already full.' };

  game.players[socketId] = {
    name: sanitize(playerName, 50),
    score: 0,
    isPlayer1: false,
  };
  game.currentAnswerer = socketId;
  game.state = 'WAITING_TO_START';
  game.lastActivityAt = Date.now();
  return { game };
}

/** Start the game. Returns error string or null. */
export function startGame(gameId: string, socketId: string): { game: GameState; error?: string } {
  const game = games.get(gameId);
  if (!game) return { game: null as any, error: 'Game not found.' };
  if (game.state !== 'WAITING_TO_START') return { game, error: 'Game cannot be started now.' };
  // Only player1 can start
  const player = game.players[socketId];
  if (!player?.isPlayer1) return { game, error: 'Only the host (Player 1) can start the game.' };

  game.state = 'AUTHORING';
  game.currentRound = 1;
  game.lastActivityAt = Date.now();
  return { game };
}

/** Store question authored by the current questioner. */
export function submitQuestion(
  gameId: string,
  socketId: string,
  question: string,
  choices: { A: string; B: string; C: string; D: string },
  correctAnswer: AnswerChoice
): { game: GameState; error?: string } {
  const game = games.get(gameId);
  if (!game) return { game: null as any, error: 'Game not found.' };
  if (game.state !== 'AUTHORING') return { game, error: 'Not in authoring phase.' };
  if (game.currentQuestioner !== socketId) return { game, error: 'It is not your turn to ask.' };

  // Rate limiting: 1 question per 2 seconds
  const now = Date.now();
  if (!game.lastQuestionAt) game.lastQuestionAt = {};
  const last = game.lastQuestionAt[socketId] ?? 0;
  if (now - last < 2000) return { game, error: 'Please wait before submitting another question.' };
  game.lastQuestionAt[socketId] = now;

  game.currentQuestion = {
    question: sanitize(question, 300),
    choices: {
      A: sanitize(choices.A, 150),
      B: sanitize(choices.B, 150),
      C: sanitize(choices.C, 150),
      D: sanitize(choices.D, 150),
    },
    correctAnswer,
  };
  game.state = 'ANSWERING';
  game.lastActivityAt = Date.now();
  return { game };
}

/** Process an answer from the current answerer. Returns scoring info. */
export function submitAnswer(
  gameId: string,
  socketId: string,
  answer: AnswerChoice | null,  // null = timed out
  timedOut = false
): {
  game: GameState;
  error?: string;
  answererCorrect?: boolean;
  pointsAwarded?: { questioner: number; answerer: number };
} {
  const game = games.get(gameId);
  if (!game) return { game: null as any, error: 'Game not found.' };
  if (game.state !== 'ANSWERING') return { game, error: 'Not in answering phase.' };
  if (!timedOut && game.currentAnswerer !== socketId) return { game, error: 'It is not your turn to answer.' };
  if (!game.currentQuestion) return { game, error: 'No active question.' };

  // Clear the server-side timer if it is still running
  if (game.answerTimer) {
    clearTimeout(game.answerTimer);
    game.answerTimer = undefined;
  }

  const answererCorrect = !timedOut && answer === game.currentQuestion.correctAnswer;
  const pointsAwarded = { questioner: 0, answerer: 0 };

  if (answererCorrect) {
    pointsAwarded.answerer = 1;
    game.players[game.currentAnswerer].score += 1;
  } else {
    // Wrong answer or timeout: questioner earns the point
    pointsAwarded.questioner = 1;
    game.players[game.currentQuestioner].score += 1;
  }

  // Record the round
  const record: RoundRecord = {
    questioner: game.currentQuestioner,
    answerer: game.currentAnswerer,
    question: game.currentQuestion.question,
    choices: game.currentQuestion.choices,
    correctAnswer: game.currentQuestion.correctAnswer,
    answererChoice: timedOut ? null : (answer ?? null),
    answererCorrect,
  };
  game.rounds.push(record);

  game.state = 'REVEAL';
  game.lastActivityAt = Date.now();
  return { game, answererCorrect, pointsAwarded };
}

/** Advance to next round. Returns isGameOver flag. */
export function advanceRound(gameId: string): { game: GameState; isGameOver: boolean } {
  const game = games.get(gameId);
  if (!game) return { game: null as any, isGameOver: false };

  // Swap questioner / answerer
  const [p1Id, p2Id] = Object.keys(game.players);
  const prevQuestioner = game.currentQuestioner;
  game.currentQuestioner = game.currentAnswerer;
  game.currentAnswerer = prevQuestioner;

  game.currentQuestion = undefined;
  game.currentRound += 1;

  game.lastActivityAt = Date.now();

  if (game.currentRound > game.totalRounds) {
    game.state = 'GAME_OVER';
    return { game, isGameOver: true };
  }

  game.state = 'AUTHORING';
  return { game, isGameOver: false };
}

/** Reset the game for a rematch using the same players / IDs. */
export function playAgain(gameId: string): { game: GameState; error?: string } {
  const game = games.get(gameId);
  if (!game) return { game: null as any, error: 'Game not found.' };
  if (game.state !== 'GAME_OVER') return { game, error: 'Game is not over yet.' };

  // Clear any lingering timers
  if (game.answerTimer) clearTimeout(game.answerTimer);
  if (game.revealTimer) clearTimeout(game.revealTimer);

  // Reset scores and state, keep same players & game length
  for (const sid of Object.keys(game.players)) {
    game.players[sid].score = 0;
  }

  // Player 1 becomes questioner again
  const p1Id = Object.keys(game.players).find(id => game.players[id].isPlayer1) ?? '';
  const p2Id = Object.keys(game.players).find(id => !game.players[id].isPlayer1) ?? '';

  game.currentQuestioner = p1Id;
  game.currentAnswerer = p2Id;
  game.currentRound = 1;
  game.rounds = [];
  game.currentQuestion = undefined;
  game.answerTimer = undefined;
  game.revealTimer = undefined;
  game.gameOverCleanupTimer = undefined;
  game.lastQuestionAt = {};
  game.lastActivityAt = Date.now();
  game.state = 'AUTHORING';

  return { game };
}

/** Build a scores map keyed by player name */
export function buildScores(game: GameState): { [playerName: string]: number } {
  const scores: { [playerName: string]: number } = {};
  for (const p of Object.values(game.players)) {
    scores[p.name] = p.score;
  }
  return scores;
}

/** Determine the winner by name (null if tied) */
export function determineWinner(game: GameState): string | null {
  const players = Object.values(game.players);
  if (players.length < 2) return players[0]?.name ?? null;
  const [a, b] = players;
  if (a.score > b.score) return a.name;
  if (b.score > a.score) return b.name;
  return null; // tie
}

/** Remove a player from a game (on disconnect). Returns remaining socket IDs. */
export function removePlayer(gameId: string, socketId: string): string[] {
  const game = games.get(gameId);
  if (!game) return [];
  delete game.players[socketId];
  return Object.keys(game.players);
}

/** Find which gameId a socket belongs to */
export function findGameBySocket(socketId: string): string | undefined {
  for (const [gameId, game] of games.entries()) {
    if (game.players[socketId]) return gameId;
  }
  return undefined;
}

/** Return all games (used for TTL cleanup) */
export function getAllGames(): Map<string, GameState> {
  return games;
}

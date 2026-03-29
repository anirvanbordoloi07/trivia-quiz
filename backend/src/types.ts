export type GameLength = 5 | 10 | 15;

export type GameStateStatus =
  | 'LOBBY'
  | 'WAITING_FOR_P2'
  | 'WAITING_TO_START'
  | 'AUTHORING'
  | 'ANSWERING'
  | 'REVEAL'
  | 'ROUND_COMPLETE'
  | 'GAME_OVER';

export type AnswerChoice = 'A' | 'B' | 'C' | 'D';

export interface PlayerState {
  name: string;
  score: number;
  isPlayer1: boolean;
}

export interface CurrentQuestion {
  question: string;
  choices: { A: string; B: string; C: string; D: string };
  correctAnswer: AnswerChoice; // NEVER sent to answerer
}

export interface RoundRecord {
  questioner: string; // socketId
  answerer: string;   // socketId
  question: string;
  choices: { A: string; B: string; C: string; D: string };
  correctAnswer: string;
  answererChoice: string | null;
  answererCorrect: boolean;
}

export interface GameState {
  gameId: string;
  gameLength: GameLength;      // questions per player
  totalRounds: number;          // gameLength * 2
  currentRound: number;
  state: GameStateStatus;
  players: {
    [socketId: string]: PlayerState;
  };
  currentQuestioner: string;   // socketId
  currentAnswerer: string;     // socketId
  currentQuestion?: CurrentQuestion;
  answerTimer?: NodeJS.Timeout;
  revealTimer?: NodeJS.Timeout;
  /** Timer scheduled to delete the game 30 min after GAME_OVER */
  gameOverCleanupTimer?: NodeJS.Timeout;
  rounds: RoundRecord[];
  // Rate limiting: track last question submission time per socket
  lastQuestionAt?: { [socketId: string]: number };
  /** Unix ms timestamp of last state-changing activity (used for stale cleanup) */
  lastActivityAt: number;
}

// ── Socket.IO event payloads ──────────────────────────────────────────────────

export interface CreateGamePayload {
  playerName: string;
  gameLength: GameLength;
}

export interface JoinGamePayload {
  gameId: string;
  playerName: string;
}

export interface StartGamePayload {
  gameId: string;
}

export interface SubmitQuestionPayload {
  gameId: string;
  question: string;
  choices: { A: string; B: string; C: string; D: string };
  correctAnswer: AnswerChoice;
}

export interface SubmitAnswerPayload {
  gameId: string;
  answer: AnswerChoice;
}

export interface NextRoundPayload {
  gameId: string;
}

export interface PlayAgainPayload {
  gameId: string;
}

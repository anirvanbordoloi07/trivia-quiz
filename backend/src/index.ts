import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  createGame,
  getGame,
  deleteGame,
  joinGame,
  startGame,
  submitQuestion,
  submitAnswer,
  advanceRound,
  playAgain,
  buildScores,
  determineWinner,
  removePlayer,
  findGameBySocket,
  sanitize,
  isValidChoice,
  isValidGameLength,
  getAllGames,
} from './gameManager';
import {
  CreateGamePayload,
  JoinGamePayload,
  StartGamePayload,
  SubmitQuestionPayload,
  SubmitAnswerPayload,
  NextRoundPayload,
  PlayAgainPayload,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const ANSWER_TIMEOUT_MS = 30_000; // 30 seconds
const REVEAL_COUNTDOWN_S = 5;     // 5-second suspense countdown
const GAME_OVER_TTL_MS   = 30 * 60 * 1000;   // 30 minutes after GAME_OVER
const STALE_GAME_TTL_MS  = 2 * 60 * 60 * 1000; // 2 hours of inactivity
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;    // run cleanup every 10 minutes

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.PRODUCTION_URL,
].filter(Boolean) as string[];

// ── Express + Socket.IO setup ─────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/game/:gameId', (req, res) => {
  const game = getGame(sanitize(req.params.gameId, 20));
  if (!game) {
    res.status(404).json({ exists: false, error: 'Game not found.' });
    return;
  }

  const players = Object.values(game.players);
  const p1 = players.find((player) => player.isPlayer1);
  const p2 = players.find((player) => !player.isPlayer1);

  res.json({
    exists: true,
    gameId: game.gameId,
    state: game.state,
    gameLength: game.gameLength,
    player1: p1?.name ?? '',
    player2: p2?.name ?? '',
    isJoinable: game.state === 'WAITING_FOR_P2' && players.length < 2,
  });
});

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

// ── Helper: get the "other" socket in a 2-player game ────────────────────────
function otherSocketId(game: ReturnType<typeof getGame>, selfId: string): string | undefined {
  if (!game) return undefined;
  return Object.keys(game.players).find(id => id !== selfId);
}

// ── Reveal countdown helper ───────────────────────────────────────────────────
/**
 * Sends countdown ticks (5 → 0) to both players, then fires the callback.
 * Stores the interval reference in game.revealTimer so it can be cancelled.
 */
function startRevealCountdown(
  gameId: string,
  p1SocketId: string,
  p2SocketId: string,
  onComplete: () => void
): void {
  let remaining = REVEAL_COUNTDOWN_S;

  const tick = () => {
    // Emit current count to both players
    io.to(p1SocketId).emit('reveal-countdown', { secondsLeft: remaining });
    io.to(p2SocketId).emit('reveal-countdown', { secondsLeft: remaining });

    if (remaining === 0) {
      onComplete();
      return;
    }
    remaining -= 1;
    const game = getGame(gameId);
    if (!game) return;
    game.revealTimer = setTimeout(tick, 1000);
  };

  tick();
}

// ── Socket.IO event handlers ──────────────────────────────────────────────────
io.on('connection', (socket: Socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── create-game ─────────────────────────────────────────────────────────────
  socket.on('create-game', (payload: CreateGamePayload) => {
    const playerName = sanitize(payload?.playerName, 50);
    if (!playerName) {
      socket.emit('error', { message: 'Player name is required.' });
      return;
    }
    if (!isValidGameLength(payload?.gameLength)) {
      socket.emit('error', { message: 'Game length must be 5, 10, or 15.' });
      return;
    }

    const game = createGame(socket.id, playerName, payload.gameLength);
    const shareLink = `${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/join/${game.gameId}`;

    socket.join(game.gameId);
    socket.emit('game-created', { gameId: game.gameId, shareLink });
    console.log(`[create-game] ${game.gameId} by ${playerName}`);
  });

  // ── join-game ────────────────────────────────────────────────────────────────
  socket.on('join-game', (payload: JoinGamePayload) => {
    const gameId = sanitize(payload?.gameId, 20);
    const playerName = sanitize(payload?.playerName, 50);

    if (!gameId || !playerName) {
      socket.emit('error', { message: 'gameId and playerName are required.' });
      return;
    }

    const { game, error } = joinGame(gameId, socket.id, playerName);
    if (error || !game) {
      socket.emit('error', { message: error ?? 'Failed to join game.' });
      return;
    }

    socket.join(gameId);

    const players = Object.values(game.players);
    const p1 = players.find(p => p.isPlayer1);
    const p2 = players.find(p => !p.isPlayer1);

    // Broadcast to both players in the room
    io.to(gameId).emit('player-joined', {
      player1: p1?.name ?? '',
      player2: p2?.name ?? '',
      gameLength: game.gameLength,
    });
    console.log(`[join-game] ${playerName} joined ${gameId}`);
  });

  // ── start-game ───────────────────────────────────────────────────────────────
  socket.on('start-game', (payload: StartGamePayload) => {
    const gameId = sanitize(payload?.gameId, 20);
    const { game, error } = startGame(gameId, socket.id);
    if (error || !game) {
      socket.emit('error', { message: error ?? 'Failed to start game.' });
      return;
    }

    const questionerSocketId = game.currentQuestioner;
    const answererSocketId   = game.currentAnswerer;
    const questionerName = game.players[questionerSocketId]?.name ?? '';
    const answererName   = game.players[answererSocketId]?.name ?? '';

    io.to(gameId).emit('game-started', {
      currentQuestionerSocketId: questionerSocketId,
      currentAnswererSocketId:   answererSocketId,
      currentQuestionerName:     questionerName,
      currentAnswererName:       answererName,
      roundNumber: game.currentRound,
      totalRounds: game.totalRounds,
    });

    // Tell each player their individual role
    socket.emit('your-turn-to-ask');
    const answererSocket = otherSocketId(game, socket.id);
    if (answererSocket) {
      io.to(answererSocket).emit('waiting-for-question');
    }

    console.log(`[start-game] ${gameId} — round ${game.currentRound}/${game.totalRounds}`);
  });

  // ── submit-question ──────────────────────────────────────────────────────────
  socket.on('submit-question', (payload: SubmitQuestionPayload) => {
    const gameId = sanitize(payload?.gameId, 20);

    if (!payload?.question || typeof payload.question !== 'string') {
      socket.emit('error', { message: 'Question text is required.' });
      return;
    }
    if (
      !payload.choices ||
      typeof payload.choices.A !== 'string' ||
      typeof payload.choices.B !== 'string' ||
      typeof payload.choices.C !== 'string' ||
      typeof payload.choices.D !== 'string'
    ) {
      socket.emit('error', { message: 'All four choices (A, B, C, D) are required.' });
      return;
    }
    if (!isValidChoice(payload.correctAnswer)) {
      socket.emit('error', { message: 'correctAnswer must be A, B, C, or D.' });
      return;
    }

    const { game, error } = submitQuestion(
      gameId,
      socket.id,
      payload.question,
      payload.choices,
      payload.correctAnswer
    );
    if (error || !game) {
      socket.emit('error', { message: error ?? 'Failed to submit question.' });
      return;
    }

    // Send question to answerer ONLY (no correctAnswer field)
    const answererSocketId = game.currentAnswerer;
    io.to(answererSocketId).emit('question-ready', {
      question: game.currentQuestion!.question,
      choices: game.currentQuestion!.choices,
    });

    // Move the questioner into the waiting state while the opponent answers.
    socket.emit('question-submitted');

    // ── Start server-enforced 30-second answer timer ─────────────────────────
    game.answerTimer = setTimeout(() => {
      handleTimeout(game.gameId, answererSocketId);
    }, ANSWER_TIMEOUT_MS);

    console.log(`[submit-question] ${gameId} round ${game.currentRound}`);
  });

  // ── submit-answer ────────────────────────────────────────────────────────────
  socket.on('submit-answer', (payload: SubmitAnswerPayload) => {
    const gameId = sanitize(payload?.gameId, 20);

    // If the answer is null, undefined, or not a valid choice (e.g. client
    // auto-submitted on timer expiry), treat it as a timeout/wrong answer
    // rather than returning an error. The server-side timer may have already
    // fired, in which case submitAnswer will reject with a state error and
    // this call is simply a no-op.
    const answer = isValidChoice(payload?.answer) ? payload.answer : null;

    processAnswer(gameId, socket.id, answer, answer === null);
  });

  // ── next-round ───────────────────────────────────────────────────────────────
  socket.on('next-round', (payload: NextRoundPayload) => {
    const gameId = sanitize(payload?.gameId, 20);
    const game = getGame(gameId);
    if (!game) {
      socket.emit('error', { message: 'Game not found.' });
      return;
    }
    if (game.state !== 'ROUND_COMPLETE') {
      socket.emit('error', { message: 'Round is not complete yet.' });
      return;
    }

    const { game: updatedGame, isGameOver } = advanceRound(gameId);
    if (!updatedGame) return;

    if (isGameOver) {
      const scores = buildScores(updatedGame);
      const winner = determineWinner(updatedGame);
      io.to(gameId).emit('game-over', {
        scores,
        winner,
        rounds: buildRoundSummaries(updatedGame),
      });
      scheduleGameOverCleanup(gameId);
      console.log(`[game-over] ${gameId} — winner: ${winner ?? 'tie'}`);
      return;
    }

    const questionerName = updatedGame.players[updatedGame.currentQuestioner]?.name ?? '';
    const answererName = updatedGame.players[updatedGame.currentAnswerer]?.name ?? '';

    io.to(gameId).emit('round-complete', {
      nextQuestioner: questionerName,
      nextAnswerer: answererName,
      roundNumber: updatedGame.currentRound,
      totalRounds: updatedGame.totalRounds,
    });

    // Role-specific prompts
    io.to(updatedGame.currentQuestioner).emit('your-turn-to-ask');
    io.to(updatedGame.currentAnswerer).emit('waiting-for-question');

    console.log(`[next-round] ${gameId} — round ${updatedGame.currentRound}/${updatedGame.totalRounds}`);
  });

  // ── play-again ───────────────────────────────────────────────────────────────
  socket.on('play-again', (payload: PlayAgainPayload) => {
    const gameId = sanitize(payload?.gameId, 20);
    const { game, error } = playAgain(gameId);
    if (error || !game) {
      socket.emit('error', { message: error ?? 'Failed to restart game.' });
      return;
    }

    const qaSocketId   = game.currentQuestioner;
    const ansSocketId  = game.currentAnswerer;
    const questionerName = game.players[qaSocketId]?.name ?? '';
    const answererName   = game.players[ansSocketId]?.name ?? '';

    io.to(gameId).emit('game-started', {
      currentQuestionerSocketId: qaSocketId,
      currentAnswererSocketId:   ansSocketId,
      currentQuestionerName:     questionerName,
      currentAnswererName:       answererName,
      roundNumber: game.currentRound,
      totalRounds: game.totalRounds,
    });

    io.to(game.currentQuestioner).emit('your-turn-to-ask');
    io.to(game.currentAnswerer).emit('waiting-for-question');

    console.log(`[play-again] ${gameId}`);
  });

  // ── new-game ─────────────────────────────────────────────────────────────────
  socket.on('new-game', () => {
    // Client wants to go back to the landing screen — nothing server-side to do
    // (they will create-game or navigate away)
    socket.emit('ready-for-new-game');
  });

  // ── disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const gameId = findGameBySocket(socket.id);
    if (!gameId) return;

    const game = getGame(gameId);
    if (!game) return;

    // Clean up timers
    if (game.answerTimer) clearTimeout(game.answerTimer);
    if (game.revealTimer) clearTimeout(game.revealTimer);

    const remainingSockets = removePlayer(gameId, socket.id);

    if (remainingSockets.length > 0) {
      // Notify the remaining player
      io.to(remainingSockets[0]).emit('error', {
        message: 'Your opponent has disconnected. The game has ended.',
      });
    }

    // Remove the game from memory
    // (Optionally keep for reconnect — not in scope for v1)
  });
});

// ── Timeout handler (called by the server-side timer) ────────────────────────
function handleTimeout(gameId: string, answererSocketId: string): void {
  console.log(`[timeout] ${gameId} — answerer ${answererSocketId} timed out`);
  processAnswer(gameId, answererSocketId, null, true);
}

// ── Shared answer processing (used by submit-answer and timeout) ──────────────
function processAnswer(
  gameId: string,
  answererSocketId: string,
  answer: 'A' | 'B' | 'C' | 'D' | null,
  timedOut: boolean
): void {
  const result = submitAnswer(gameId, answererSocketId, answer, timedOut);
  if (result.error || !result.game) {
    io.to(answererSocketId).emit('error', { message: result.error ?? 'Failed to submit answer.' });
    return;
  }

  const game = result.game;
  const scores = buildScores(game);
  const questionerName = game.players[game.currentQuestioner]?.name ?? '';
  const answererName = game.players[game.currentAnswerer]?.name ?? '';

  // Notify questioner that an answer was submitted
  io.to(game.currentQuestioner).emit('answer-submitted', { answererName });

  // Get the two socket IDs
  const socketIds = Object.keys(game.players);
  const [p1Id, p2Id] = socketIds;

  // Start 5-second reveal countdown
  startRevealCountdown(gameId, p1Id, p2Id, () => {
    const currentGame = getGame(gameId);
    if (!currentGame) return;

    // Send reveal to both players
    io.to(gameId).emit('reveal', {
      correctAnswer: currentGame.currentQuestion?.correctAnswer ?? '',
      answererChoice: timedOut ? null : answer,
      answererCorrect: result.answererCorrect ?? false,
      pointsAwarded: result.pointsAwarded,
      scores: buildScores(currentGame),
    });

    currentGame.state = 'ROUND_COMPLETE';

    // Check if this was the last round
    if (currentGame.currentRound >= currentGame.totalRounds) {
      // Automatically trigger game over after a short delay
      setTimeout(() => {
        const finalGame = getGame(gameId);
        if (!finalGame || finalGame.state !== 'ROUND_COMPLETE') return;
        const { game: doneGame, isGameOver } = advanceRound(gameId);
        if (isGameOver && doneGame) {
          const finalScores = buildScores(doneGame);
          const winner = determineWinner(doneGame);
          io.to(gameId).emit('game-over', {
            scores: finalScores,
            winner,
            rounds: buildRoundSummaries(doneGame),
          });
          scheduleGameOverCleanup(gameId);
          console.log(`[game-over] ${gameId} — winner: ${winner ?? 'tie'}`);
        }
      }, 3000); // 3-second pause after reveal before game-over
    }
  });
}

function buildRoundSummaries(game: NonNullable<ReturnType<typeof getGame>>) {
  return game.rounds.map((round, index) => ({
    roundNumber: index + 1,
    questionerName: game.players[round.questioner]?.name ?? 'Unknown',
    answererName: game.players[round.answerer]?.name ?? 'Unknown',
    question: round.question,
    choices: round.choices,
    correctAnswer: round.correctAnswer,
    answererChoice: round.answererChoice,
    answererCorrect: round.answererCorrect,
  }));
}

// ── Session TTL cleanup ───────────────────────────────────────────────────────

/**
 * Schedule deletion of a finished game from the in-memory store.
 * Called once a game reaches GAME_OVER state.
 */
function scheduleGameOverCleanup(gameId: string): void {
  const game = getGame(gameId);
  if (!game) return;
  // Cancel any pre-existing timer (e.g. from a play-again that re-ended)
  if (game.gameOverCleanupTimer) clearTimeout(game.gameOverCleanupTimer);

  game.gameOverCleanupTimer = setTimeout(() => {
    console.log(`[cleanup] Removing finished game ${gameId} after 30-minute TTL`);
    deleteGame(gameId);
  }, GAME_OVER_TTL_MS);
}

/**
 * Periodic sweep: remove games that have been inactive for more than 2 hours
 * and are not yet in a terminal state (covers abandoned games).
 */
function runStaleGameCleanup(): void {
  const now = Date.now();
  let removed = 0;
  for (const [gameId, game] of getAllGames().entries()) {
    if (game.state === 'GAME_OVER') continue; // already handled by scheduleGameOverCleanup
    if (now - game.lastActivityAt > STALE_GAME_TTL_MS) {
      // Cancel any live timers before deleting
      if (game.answerTimer) clearTimeout(game.answerTimer);
      if (game.revealTimer) clearTimeout(game.revealTimer);
      if (game.gameOverCleanupTimer) clearTimeout(game.gameOverCleanupTimer);
      deleteGame(gameId);
      removed += 1;
    }
  }
  if (removed > 0) {
    console.log(`[cleanup] Removed ${removed} stale game(s) during periodic sweep`);
  }
}

// Start periodic cleanup
setInterval(runStaleGameCleanup, CLEANUP_INTERVAL_MS);

// ── Start server ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Trivia Quiz backend running on http://localhost:${PORT}`);
  console.log(`Allowed CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

export { io, httpServer };

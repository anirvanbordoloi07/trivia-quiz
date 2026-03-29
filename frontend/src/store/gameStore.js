import { create } from 'zustand'

function secondsUntil(timestamp, fallback = 0) {
  if (!timestamp) return fallback
  const diffMs = new Date(timestamp).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / 1000))
}

function buildChoices(round) {
  if (!round) return null
  return {
    A: round.choice_a,
    B: round.choice_b,
    C: round.choice_c,
    D: round.choice_d,
  }
}

function deriveCompletedRounds(rounds, playersByRole) {
  return rounds
    .filter((round) => round.status === 'revealed' || round.status === 'scored')
    .map((round) => ({
      roundNumber: round.round_number,
      questionerName: playersByRole[round.questioner_role]?.display_name ?? round.questioner_role,
      answererName: playersByRole[round.answerer_role]?.display_name ?? round.answerer_role,
      question: round.question_text,
      choices: {
        A: round.choice_a,
        B: round.choice_b,
        C: round.choice_c,
        D: round.choice_d,
      },
      correctAnswer: round.correct_choice,
      answererChoice: round.submitted_choice,
      answererCorrect: round.answerer_correct,
      timedOut: round.timed_out,
    }))
}

function deriveRevealData(game, round, playersByRole) {
  if (!round || (game.status !== 'reveal' && game.status !== 'completed')) return null

  const questionerRole = round.questioner_role
  const answererRole = round.answerer_role
  const questionerName = playersByRole[questionerRole]?.display_name ?? questionerRole
  const answererName = playersByRole[answererRole]?.display_name ?? answererRole

  return {
    correctAnswer: round.correct_choice,
    answererChoice: round.submitted_choice,
    answererCorrect: !!round.answerer_correct,
    timedOut: !!round.timed_out,
    questionerName,
    answererName,
    pointsAwarded: {
      questioner: round.score_awarded_to === questionerRole ? 1 : 0,
      answerer: round.score_awarded_to === answererRole ? 1 : 0,
    },
    scores: {
      [questionerName]: playersByRole[questionerRole]?.score ?? 0,
      [answererName]: playersByRole[answererRole]?.score ?? 0,
    },
  }
}

function derivePhase(game, me) {
  if (!game) return 'idle'

  switch (game.status) {
    case 'lobby':
      return 'waiting-room'
    case 'authoring':
      return me?.role === game.current_questioner_role ? 'authoring' : 'waiting-for-question'
    case 'answering':
      return me?.role === game.current_answerer_role ? 'answering' : 'questioner-waiting'
    case 'reveal':
      return 'reveal'
    case 'completed':
      return 'game-over'
    default:
      return 'idle'
  }
}

const useGameStore = create((set, get) => ({
  connected: false,
  socketId: null,

  gameId: null,
  playerToken: null,
  shareLink: null,
  joinCode: null,
  myRole: null,
  myName: null,

  gameLength: 10,
  player1: null,
  player2: null,

  phase: 'idle',
  currentQuestioner: null,
  currentAnswerer: null,
  roundNumber: 0,
  totalRounds: 0,
  winner: null,
  completedRounds: [],

  question: null,
  choices: null,
  selectedAnswer: null,
  timeLeft: 30,
  timerActive: false,
  answerDeadlineAt: null,
  answerSubmitted: false,

  revealData: null,
  revealCountdown: 5,
  revealDeadlineAt: null,

  scores: { player1: 0, player2: 0 },
  error: null,

  setConnected: (connected, socketId = null) => set({ connected, socketId }),
  setMyName: (name) => set({ myName: name }),
  setGameId: (gameId) => set({ gameId }),
  setGameLength: (gameLength) => set({ gameLength }),
  setError: (message) => set({ error: message }),
  clearError: () => set({ error: null }),
  setAnswerSubmitted: (answerSubmitted) => set({ answerSubmitted }),
  selectAnswer: (answer) => set({ selectedAnswer: answer }),
  setTimeLeft: (timeLeft) => set({ timeLeft }),
  setTimerActive: (timerActive) => set({ timerActive }),
  setRevealCountdown: (revealCountdown) => set({ revealCountdown }),

  setSession: ({ gameId, playerToken, myRole, myName, joinCode = null }) =>
    set({
      gameId,
      playerToken,
      myRole,
      myName,
      joinCode,
      shareLink: gameId ? `${window.location.origin}/join/${gameId}` : null,
      phase: gameId ? 'waiting-room' : 'idle',
    }),

  applySnapshot: (snapshot) => {
    const game = snapshot?.game
    const me = snapshot?.player
    const players = snapshot?.players ?? []
    const rounds = snapshot?.rounds ?? []
    const currentRound = snapshot?.current_round ?? null

    if (!game || !me) return

    const playersByRole = Object.fromEntries(players.map((player) => [player.role, player]))
    const player1 = playersByRole.player1
      ? { id: playersByRole.player1.id, name: playersByRole.player1.display_name, role: 'player1' }
      : null
    const player2 = playersByRole.player2
      ? { id: playersByRole.player2.id, name: playersByRole.player2.display_name, role: 'player2' }
      : null

    const phase = derivePhase(game, me)
    const scores = {
      player1: player1 ? playersByRole.player1.score : 0,
      player2: player2 ? playersByRole.player2.score : 0,
    }

    const currentQuestioner = game.current_questioner_role
      ? playersByRole[game.current_questioner_role]?.display_name ?? null
      : null
    const currentAnswerer = game.current_answerer_role
      ? playersByRole[game.current_answerer_role]?.display_name ?? null
      : null

    const answerDeadlineAt = game.answer_deadline_at ?? null
    const revealDeadlineAt = game.reveal_deadline_at ?? null
    const timeLeft = phase === 'answering' ? secondsUntil(answerDeadlineAt, 30) : 30
    const revealCountdown = phase === 'reveal' ? secondsUntil(revealDeadlineAt, 0) : 5
    const completedRounds = deriveCompletedRounds(rounds, playersByRole)
    const revealData = deriveRevealData(game, currentRound, playersByRole)

    set({
      gameId: game.id,
      playerToken: me.player_token,
      shareLink: `${window.location.origin}/join/${game.id}`,
      joinCode: game.join_code,
      myRole: me.role,
      myName: me.display_name,
      gameLength: game.questions_per_player,
      player1,
      player2,
      phase,
      currentQuestioner,
      currentAnswerer,
      roundNumber: game.current_round_number,
      totalRounds: game.total_rounds,
      winner: game.winner_role ? playersByRole[game.winner_role]?.display_name ?? null : 'tie',
      completedRounds,
      question: currentRound?.question_text ?? null,
      choices: buildChoices(currentRound),
      timeLeft,
      timerActive: phase === 'answering' && timeLeft > 0,
      answerDeadlineAt,
      answerSubmitted: !!currentRound?.submitted_choice || !!currentRound?.timed_out,
      revealData,
      revealCountdown,
      revealDeadlineAt,
      scores,
      error: null,
    })
  },

  resetGame: () => set({
    connected: false,
    socketId: null,
    gameId: null,
    playerToken: null,
    shareLink: null,
    joinCode: null,
    myRole: null,
    myName: null,
    gameLength: 10,
    player1: null,
    player2: null,
    phase: 'idle',
    currentQuestioner: null,
    currentAnswerer: null,
    roundNumber: 0,
    totalRounds: 0,
    winner: null,
    completedRounds: [],
    question: null,
    choices: null,
    selectedAnswer: null,
    timeLeft: 30,
    timerActive: false,
    answerDeadlineAt: null,
    answerSubmitted: false,
    revealData: null,
    revealCountdown: 5,
    revealDeadlineAt: null,
    scores: { player1: 0, player2: 0 },
    error: null,
  }),
}))

export default useGameStore

import { create } from 'zustand'

/**
 * Game phases:
 * 'idle'          - not in a game
 * 'lobby'         - creating game (P1)
 * 'joining'       - joining game (P2)
 * 'waiting-room'  - both connected, waiting for start
 * 'authoring'     - current player writing a question
 * 'waiting-for-question' - other player waiting while question is authored
 * 'answering'     - player answering a question
 * 'reveal'        - showing result after answer
 * 'game-over'     - game finished
 */

const useGameStore = create((set, get) => ({
  // Connection
  connected: false,
  socketId: null,

  // Game identity
  gameId: null,
  shareLink: null,
  myRole: null,        // 'player1' | 'player2'
  myName: null,

  // Game config
  gameLength: 10,      // 5 | 10 | 15
  player1: null,       // { name, id }
  player2: null,       // { name, id }

  // Round state
  phase: 'idle',
  currentQuestioner: null,   // player name
  currentAnswerer: null,     // player name
  roundNumber: 0,
  totalRounds: 0,
  winner: null,
  completedRounds: [],

  // Question/answer state
  question: null,
  choices: null,       // { A, B, C, D }
  selectedAnswer: null,
  timeLeft: 30,
  timerActive: false,
  answerSubmitted: false,

  // Reveal state
  revealData: null,    // { correctAnswer, answererChoice, answererCorrect, pointsAwarded, scores }
  revealCountdown: 5,

  // Scores
  scores: { player1: 0, player2: 0 },

  // Error
  error: null,

  // ---- Actions ----

  setConnected: (connected, socketId = null) => set({ connected, socketId }),

  setMyName: (name) => set({ myName: name }),

  setGameId: (gameId) => set({ gameId }),

  setGameLength: (length) => set({ gameLength: length }),

  setError: (message) => set({ error: message }),

  clearError: () => set({ error: null }),

  // Game created (P1)
  onGameCreated: ({ gameId, shareLink }) => {
    set({
      gameId,
      shareLink,
      myRole: 'player1',
      phase: 'waiting-room',
    })
  },

  // Player joined (both players)
  // Server sends player1/player2 as plain name strings; store as { name } objects
  onPlayerJoined: ({ player1, player2, gameLength }) => {
    set({
      player1: player1 ? { name: player1 } : null,
      player2: player2 ? { name: player2 } : null,
      gameLength,
      myRole: get().myRole ?? 'player2',
      phase: 'waiting-room',
    })
  },

  // Game started — store round/role info; phase is set by the follow-up
  // your-turn-to-ask / waiting-for-question events (socket-ID-targeted, not name-based)
  onGameStarted: ({
    currentQuestionerName,
    currentAnswererName,
    roundNumber,
    totalRounds,
  }) => {
    set({
      currentQuestioner: currentQuestionerName,
      currentAnswerer: currentAnswererName,
      roundNumber,
      totalRounds,
      winner: null,
      completedRounds: [],
      question: null,
      choices: null,
      selectedAnswer: null,
      revealData: null,
    })
  },

  onQuestionSubmitted: () => {
    set({
      phase: 'questioner-waiting',
      timerActive: false,
    })
  },

  // It's my turn to ask
  onYourTurnToAsk: () => {
    set({
      phase: 'authoring',
      question: null,
      choices: null,
      selectedAnswer: null,
      answerSubmitted: false,
      revealData: null,
    })
  },

  // Waiting for opponent to author a question
  onWaitingForQuestion: () => {
    set({
      phase: 'waiting-for-question',
      question: null,
      choices: null,
      selectedAnswer: null,
      answerSubmitted: false,
    })
  },

  // Question ready to answer (answerer only — no correct answer)
  onQuestionReady: ({ question, choices }) => {
    set({
      phase: 'answering',
      question,
      choices,
      selectedAnswer: null,
      answerSubmitted: false,
      timeLeft: 30,
      timerActive: true,
    })
  },

  // Answer was submitted (notification)
  onAnswerSubmitted: ({ answererName }) => {
    // questioner sees this — someone submitted
    set({ timerActive: false, answerSubmitted: true })
  },

  // Reveal result
  // Server sends scores as { [playerName]: number }; remap to { player1, player2 }
  onReveal: (data) => {
    const { player1, player2 } = get()
    const rawScores = data.scores || {}
    const mappedScores = {
      player1: rawScores[player1?.name] ?? 0,
      player2: rawScores[player2?.name] ?? 0,
    }
    set({
      phase: 'reveal',
      revealData: data,
      scores: mappedScores,
      timerActive: false,
      // revealCountdown is driven to 0 by server reveal-countdown ticks before this fires
      revealCountdown: 0,
    })
  },

  // Round complete — store next round info; phase is set by follow-up
  // your-turn-to-ask / waiting-for-question events (socket-ID-targeted, not name-based)
  onRoundComplete: ({ nextQuestioner, nextAnswerer, roundNumber }) => {
    set({
      currentQuestioner: nextQuestioner,
      currentAnswerer: nextAnswerer,
      roundNumber,
      question: null,
      choices: null,
      selectedAnswer: null,
      answerSubmitted: false,
      revealData: null,
      revealCountdown: 5,
    })
  },

  // Game over
  // Server sends scores as { [playerName]: number }; remap to { player1, player2 }
  onGameOver: ({ scores: rawScores, winner, rounds = [] }) => {
    const { player1, player2 } = get()
    const mappedScores = {
      player1: rawScores[player1?.name] ?? 0,
      player2: rawScores[player2?.name] ?? 0,
    }
    set({
      phase: 'game-over',
      scores: mappedScores,
      winner,
      completedRounds: rounds,
      timerActive: false,
    })
  },

  setCompletedRounds: (completedRounds) => set({ completedRounds }),

  // Local actions
  selectAnswer: (answer) => set({ selectedAnswer: answer }),

  setAnswerSubmitted: (answerSubmitted) => set({ answerSubmitted }),

  setTimeLeft: (timeLeft) => set({ timeLeft }),

  setTimerActive: (active) => set({ timerActive: active }),

  setRevealCountdown: (n) => set({ revealCountdown: n }),

  resetGame: () => set({
    gameId: null,
    shareLink: null,
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
    answerSubmitted: false,
    revealData: null,
    revealCountdown: 5,
    scores: { player1: 0, player2: 0 },
    error: null,
  }),
}))

export default useGameStore

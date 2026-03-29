import { useEffect, useCallback } from 'react'
import { connectSocket, getSocket } from '../utils/socket'
import useGameStore from '../store/gameStore'

/**
 * Central hook that connects to the socket server and wires
 * all incoming events to the Zustand store.
 */
export function useSocket() {
  const store = useGameStore()

  useEffect(() => {
    const socket = connectSocket()

    // Connection events
    socket.on('connect', () => {
      store.setConnected(true, socket.id)
    })

    socket.on('disconnect', () => {
      store.setConnected(false, null)
    })

    // Game events
    socket.on('game-created', (data) => {
      store.onGameCreated(data)
    })

    socket.on('player-joined', (data) => {
      store.onPlayerJoined(data)
    })

    socket.on('game-started', (data) => {
      store.onGameStarted(data)
    })

    socket.on('question-submitted', () => {
      store.onQuestionSubmitted()
    })

    socket.on('your-turn-to-ask', () => {
      store.onYourTurnToAsk()
    })

    socket.on('waiting-for-question', () => {
      store.onWaitingForQuestion()
    })

    socket.on('question-ready', (data) => {
      store.onQuestionReady(data)
    })

    socket.on('answer-submitted', (data) => {
      store.onAnswerSubmitted(data)
    })

    socket.on('reveal-countdown', ({ secondsLeft }) => {
      store.setRevealCountdown(secondsLeft)
    })

    socket.on('reveal', (data) => {
      store.onReveal(data)
    })

    socket.on('round-complete', (data) => {
      store.onRoundComplete(data)
    })

    socket.on('game-over', (data) => {
      store.onGameOver(data)
    })

    socket.on('error', ({ message }) => {
      store.setError(message)
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('game-created')
      socket.off('player-joined')
      socket.off('game-started')
      socket.off('question-submitted')
      socket.off('your-turn-to-ask')
      socket.off('waiting-for-question')
      socket.off('question-ready')
      socket.off('answer-submitted')
      socket.off('reveal-countdown')
      socket.off('reveal')
      socket.off('round-complete')
      socket.off('game-over')
      socket.off('error')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Emit helpers
  const createGame = useCallback(({ playerName, gameLength }) => {
    const socket = getSocket()
    socket.emit('create-game', { playerName, gameLength })
  }, [])

  const joinGame = useCallback(({ gameId, playerName }) => {
    const socket = getSocket()
    socket.emit('join-game', { gameId, playerName })
  }, [])

  const startGame = useCallback(({ gameId }) => {
    const socket = getSocket()
    socket.emit('start-game', { gameId })
  }, [])

  const submitQuestion = useCallback(({ gameId, question, choices, correctAnswer }) => {
    const socket = getSocket()
    socket.emit('submit-question', { gameId, question, choices, correctAnswer })
  }, [])

  const submitAnswer = useCallback(({ gameId, answer }) => {
    const socket = getSocket()
    socket.emit('submit-answer', { gameId, answer })
  }, [])

  const nextRound = useCallback(({ gameId }) => {
    const socket = getSocket()
    socket.emit('next-round', { gameId })
  }, [])

  const playAgain = useCallback(({ gameId }) => {
    const socket = getSocket()
    socket.emit('play-again', { gameId })
  }, [])

  const newGame = useCallback(() => {
    const socket = getSocket()
    socket.emit('new-game', {})
  }, [])

  return {
    createGame,
    joinGame,
    startGame,
    submitQuestion,
    submitAnswer,
    nextRound,
    playAgain,
    newGame,
  }
}

export default useSocket

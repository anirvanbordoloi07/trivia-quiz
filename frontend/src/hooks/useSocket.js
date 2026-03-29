import { useEffect, useCallback } from 'react'
import { connectSocket, getSocket } from '../utils/socket'
import useGameStore from '../store/gameStore'

/**
 * Register socket listeners exactly once for the current React tree.
 */
export function useSocketEvents() {
  const store = useGameStore()

  useEffect(() => {
    const socket = connectSocket()
    const handleConnect = () => {
      store.setConnected(true, socket.id)
    }
    const handleDisconnect = () => {
      store.setConnected(false, null)
    }
    const handleGameCreated = (data) => {
      store.onGameCreated(data)
    }
    const handlePlayerJoined = (data) => {
      store.onPlayerJoined(data)
    }
    const handleGameStarted = (data) => {
      store.onGameStarted(data)
    }
    const handleQuestionSubmitted = () => {
      store.onQuestionSubmitted()
    }
    const handleYourTurnToAsk = () => {
      store.onYourTurnToAsk()
    }
    const handleWaitingForQuestion = () => {
      store.onWaitingForQuestion()
    }
    const handleQuestionReady = (data) => {
      store.onQuestionReady(data)
    }
    const handleAnswerSubmitted = (data) => {
      store.onAnswerSubmitted(data)
    }
    const handleRevealCountdown = ({ secondsLeft }) => {
      store.setRevealCountdown(secondsLeft)
    }
    const handleReveal = (data) => {
      store.onReveal(data)
    }
    const handleRoundComplete = (data) => {
      store.onRoundComplete(data)
    }
    const handleGameOver = (data) => {
      store.onGameOver(data)
    }
    const handleError = ({ message }) => {
      store.setError(message)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('game-created', handleGameCreated)
    socket.on('player-joined', handlePlayerJoined)
    socket.on('game-started', handleGameStarted)
    socket.on('question-submitted', handleQuestionSubmitted)
    socket.on('your-turn-to-ask', handleYourTurnToAsk)
    socket.on('waiting-for-question', handleWaitingForQuestion)
    socket.on('question-ready', handleQuestionReady)
    socket.on('answer-submitted', handleAnswerSubmitted)
    socket.on('reveal-countdown', handleRevealCountdown)
    socket.on('reveal', handleReveal)
    socket.on('round-complete', handleRoundComplete)
    socket.on('game-over', handleGameOver)
    socket.on('error', handleError)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('game-created', handleGameCreated)
      socket.off('player-joined', handlePlayerJoined)
      socket.off('game-started', handleGameStarted)
      socket.off('question-submitted', handleQuestionSubmitted)
      socket.off('your-turn-to-ask', handleYourTurnToAsk)
      socket.off('waiting-for-question', handleWaitingForQuestion)
      socket.off('question-ready', handleQuestionReady)
      socket.off('answer-submitted', handleAnswerSubmitted)
      socket.off('reveal-countdown', handleRevealCountdown)
      socket.off('reveal', handleReveal)
      socket.off('round-complete', handleRoundComplete)
      socket.off('game-over', handleGameOver)
      socket.off('error', handleError)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Emit helper hook used by pages and actions.
 */
export function useSocket() {
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

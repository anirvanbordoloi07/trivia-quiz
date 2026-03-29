import { useCallback, useEffect } from 'react'
import supabase from '../lib/supabase'
import {
  advanceRound as advanceRoundRpc,
  clearPlayerSession,
  createGame as createGameRpc,
  getGameSnapshot,
  joinGameById,
  loadPlayerSession,
  markPlayerDisconnected,
  resumePlayer,
  savePlayerSession,
  startGame as startGameRpc,
  submitAnswer as submitAnswerRpc,
  submitQuestion as submitQuestionRpc,
  submitTimeout as submitTimeoutRpc,
} from '../lib/triviaApi'
import useGameStore from '../store/gameStore'

async function refreshSnapshot() {
  const { gameId, playerToken, applySnapshot, setError } = useGameStore.getState()
  if (!gameId || !playerToken) return

  try {
    const snapshot = await getGameSnapshot(gameId, playerToken)
    applySnapshot(snapshot)
  } catch (error) {
    setError(error.message || 'Failed to sync game state.')
  }
}

export function useSocketEvents() {
  const {
    gameId,
    playerToken,
    setConnected,
    setError,
    setSession,
    applySnapshot,
  } = useGameStore()

  useEffect(() => {
    const saved = loadPlayerSession()
    if (saved?.gameId && saved?.playerToken && !gameId && !playerToken) {
      setSession(saved)
    }
  }, [gameId, playerToken, setSession])

  useEffect(() => {
    if (!gameId || !playerToken) {
      setConnected(true, null)
      return undefined
    }

    let cancelled = false

    const sync = async () => {
      try {
        const snapshot = await getGameSnapshot(gameId, playerToken)
        if (!cancelled) {
          applySnapshot(snapshot)
        }
      } catch (error) {
        if (!cancelled) {
          setError(error.message || 'Failed to resume game.')
        }
      }
    }

    resumePlayer(gameId, playerToken)
      .then((snapshot) => {
        if (!cancelled) {
          applySnapshot(snapshot)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(error.message || 'Failed to resume game.')
        }
      })

    const channel = supabase
      .channel(`trivia-game-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'trivia', table: 'games', filter: `id=eq.${gameId}` }, sync)
      .on('postgres_changes', { event: '*', schema: 'trivia', table: 'game_players', filter: `game_id=eq.${gameId}` }, sync)
      .on('postgres_changes', { event: '*', schema: 'trivia', table: 'game_rounds', filter: `game_id=eq.${gameId}` }, sync)
      .subscribe((status) => {
        if (!cancelled) {
          setConnected(status === 'SUBSCRIBED', null)
        }
      })

    return () => {
      cancelled = true
      if (gameId && playerToken) {
        markPlayerDisconnected(gameId, playerToken).catch(() => {})
      }
      supabase.removeChannel(channel)
    }
  }, [applySnapshot, gameId, playerToken, setConnected, setError])

  useEffect(() => {
    const updateCountdowns = () => {
      const store = useGameStore.getState()
      if (store.phase === 'answering' && store.answerDeadlineAt) {
        const nextTimeLeft = Math.max(
          0,
          Math.ceil((new Date(store.answerDeadlineAt).getTime() - Date.now()) / 1000)
        )
        store.setTimeLeft(nextTimeLeft)
        store.setTimerActive(nextTimeLeft > 0)
      }

      if (store.phase === 'reveal' && store.revealDeadlineAt) {
        const nextRevealCountdown = Math.max(
          0,
          Math.ceil((new Date(store.revealDeadlineAt).getTime() - Date.now()) / 1000)
        )
        store.setRevealCountdown(nextRevealCountdown)
      }
    }

    updateCountdowns()
    const interval = window.setInterval(updateCountdowns, 1000)
    return () => window.clearInterval(interval)
  }, [])
}

export function useSocket() {
  const { setError, clearError, setMyName, setSession, applySnapshot, gameId, playerToken, resetGame } = useGameStore()

  const createGame = useCallback(async ({ playerName, gameLength }) => {
    clearError()
    try {
      setMyName(playerName)
      const session = await createGameRpc(playerName, gameLength)
      const localSession = {
        gameId: session.game_id,
        playerToken: session.player_token,
        myRole: session.player_role,
        myName: playerName,
        joinCode: session.join_code,
      }
      savePlayerSession(localSession)
      setSession(localSession)
      const snapshot = await resumePlayer(session.game_id, session.player_token)
      applySnapshot(snapshot)
    } catch (error) {
      setError(error.message || 'Failed to create game.')
    }
  }, [applySnapshot, clearError, setError, setMyName, setSession])

  const joinGame = useCallback(async ({ gameId: nextGameId, playerName }) => {
    clearError()
    try {
      setMyName(playerName)
      const session = await joinGameById(nextGameId, playerName)
      const localSession = {
        gameId: session.game_id,
        playerToken: session.player_token,
        myRole: session.player_role,
        myName: playerName,
        joinCode: session.join_code,
      }
      savePlayerSession(localSession)
      setSession(localSession)
      const snapshot = await resumePlayer(session.game_id, session.player_token)
      applySnapshot(snapshot)
    } catch (error) {
      setError(error.message || 'Failed to join game.')
    }
  }, [applySnapshot, clearError, setError, setMyName, setSession])

  const startGame = useCallback(async ({ gameId: nextGameId }) => {
    clearError()
    try {
      const snapshot = await startGameRpc(nextGameId, useGameStore.getState().playerToken)
      applySnapshot(snapshot)
    } catch (error) {
      setError(error.message || 'Failed to start game.')
    }
  }, [applySnapshot, clearError, setError])

  const submitQuestion = useCallback(async ({ gameId: nextGameId, question, choices, correctAnswer }) => {
    clearError()
    try {
      const snapshot = await submitQuestionRpc(nextGameId, useGameStore.getState().playerToken, {
        question,
        choices,
        correctAnswer,
      })
      applySnapshot(snapshot)
    } catch (error) {
      setError(error.message || 'Failed to submit question.')
    }
  }, [applySnapshot, clearError, setError])

  const submitAnswer = useCallback(async ({ gameId: nextGameId, answer }) => {
    clearError()
    try {
      const snapshot = await submitAnswerRpc(nextGameId, useGameStore.getState().playerToken, answer)
      applySnapshot(snapshot)
    } catch (error) {
      setError(error.message || 'Failed to submit answer.')
    }
  }, [applySnapshot, clearError, setError])

  const submitTimeout = useCallback(async () => {
    const liveGameId = useGameStore.getState().gameId
    const livePlayerToken = useGameStore.getState().playerToken
    if (!liveGameId || !livePlayerToken) return

    try {
      const snapshot = await submitTimeoutRpc(liveGameId, livePlayerToken)
      applySnapshot(snapshot)
    } catch (error) {
      setError(error.message || 'Failed to finalize timeout.')
    }
  }, [applySnapshot, setError])

  const nextRound = useCallback(async ({ gameId: nextGameId }) => {
    clearError()
    try {
      const snapshot = await advanceRoundRpc(nextGameId, useGameStore.getState().playerToken)
      applySnapshot(snapshot)
    } catch (error) {
      setError(error.message || 'Failed to advance round.')
    }
  }, [applySnapshot, clearError, setError])

  const playAgain = useCallback(() => {
    clearPlayerSession()
    resetGame()
    window.location.href = '/'
  }, [resetGame])

  const newGame = useCallback(() => {
    clearPlayerSession()
    resetGame()
  }, [resetGame])

  return {
    createGame,
    joinGame,
    startGame,
    submitQuestion,
    submitAnswer,
    submitTimeout,
    nextRound,
    playAgain,
    newGame,
    refreshSnapshot,
  }
}

export default useSocket

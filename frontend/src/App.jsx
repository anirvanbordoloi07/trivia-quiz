import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { connectSocket } from './utils/socket'
import useGameStore from './store/gameStore'
import { useSocketEvents } from './hooks/useSocket'
import ConnectionStatus from './components/ConnectionStatus'

// Pages
import HomePage from './pages/HomePage'
import JoinPage from './pages/JoinPage'
import WaitingRoomPage from './pages/WaitingRoomPage'
import QuestionAuthoringPage from './pages/QuestionAuthoringPage'
import WaitingForQuestionPage from './pages/WaitingForQuestionPage'
import AnsweringPage from './pages/AnsweringPage'
import RevealPage from './pages/RevealPage'
import QuestionerWaitingPage from './pages/QuestionerWaitingPage'
import GameOverPage from './pages/GameOverPage'

/**
 * GameRouter: decides which page to show based on the current game phase.
 * All real game state lives in Zustand — the URL is secondary for in-game flow.
 */
function GameRouter() {
  // Initialize socket listeners
  useSocketEvents()

  const { phase } = useGameStore()

  // Connect the socket on mount
  useEffect(() => {
    connectSocket()
  }, [])

  switch (phase) {
    case 'waiting-room':
      return <WaitingRoomPage />

    case 'authoring':
      return <QuestionAuthoringPage />

    case 'waiting-for-question':
      return <WaitingForQuestionPage />

    case 'answering':
      return <AnsweringPage />

    case 'questioner-waiting':
      return <QuestionerWaitingPage />

    case 'reveal':
      return <RevealPage />

    case 'game-over':
      return <GameOverPage />

    // 'idle', 'lobby', 'joining', or anything unexpected falls through to routing
    default:
      return null
  }
}

/**
 * Top-level App with React Router for shareable join links.
 * If phase is set (in-game), GameRouter takes over regardless of URL.
 */
export default function App() {
  const { phase } = useGameStore()
  const inGame = phase !== 'idle' && phase !== 'lobby' && phase !== 'joining'

  return (
    <BrowserRouter>
      {inGame ? (
        // Once in a game, ignore the URL and show the appropriate game screen
        <>
          <GameRouter />
          <ConnectionStatus />
        </>
      ) : (
        <>
          {/* Socket listener must be active even on home/join pages */}
          <SocketInit />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/join/:gameId" element={<JoinPage />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ConnectionStatus />
        </>
      )}
    </BrowserRouter>
  )
}

/**
 * Invisible component that mounts socket hooks on non-game pages.
 */
function SocketInit() {
  useSocketEvents()
  useEffect(() => {
    connectSocket()
  }, [])
  return null
}

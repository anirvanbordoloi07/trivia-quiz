import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import useGameStore from '../store/gameStore'
import useSocket from '../hooks/useSocket'
import PageWrapper from '../components/PageWrapper'

export default function JoinPage() {
  const { gameId: paramGameId } = useParams()
  const [searchParams] = useSearchParams()
  const urlGameId = paramGameId || searchParams.get('game')

  const [playerName, setPlayerName] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const { setMyName, setGameId, myRole } = useGameStore()
  const { joinGame } = useSocket()

  // If already in the game (re-render after join), stop spinner
  useEffect(() => {
    if (myRole) {
      setIsJoining(false)
    }
  }, [myRole])

  useEffect(() => {
    if (urlGameId) {
      setGameId(urlGameId)
    }
  }, [urlGameId, setGameId])

  const handleJoin = (e) => {
    e.preventDefault()
    if (!playerName.trim() || !urlGameId) return
    setIsJoining(true)
    setMyName(playerName.trim())
    setGameId(urlGameId)
    joinGame({ gameId: urlGameId, playerName: playerName.trim() })
  }

  return (
    <PageWrapper showScoreboard={false}>
      <div className="animate-fade-in text-center mb-8">
        <div className="text-5xl mb-3">🎯</div>
        <h2 className="text-3xl font-black text-gradient mb-2">Join Game</h2>
        <p className="text-indigo-300 text-sm">You've been invited to a Trivia Duel!</p>
        {urlGameId && (
          <div className="mt-2 inline-block bg-indigo-900/50 border border-indigo-700/50 rounded-lg px-3 py-1">
            <span className="text-indigo-400 text-xs">Game ID: </span>
            <span className="text-indigo-200 text-xs font-mono">{urlGameId}</span>
          </div>
        )}
      </div>

      <div className="card-glow animate-slide-up">
        <h3 className="text-lg font-bold text-white mb-1">Enter Your Name</h3>
        <p className="text-indigo-400 text-sm mb-5">You'll be Player 2 — ready to answer first!</p>

        {!urlGameId && (
          <div className="mb-4 bg-amber-900/30 border border-amber-700/50 rounded-xl p-3">
            <p className="text-amber-300 text-sm">No game ID found in the URL. Make sure you used the full invite link.</p>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-1.5">
              Your Display Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="input-field"
              maxLength={20}
              autoFocus
              disabled={!urlGameId}
            />
          </div>

          <button
            type="submit"
            disabled={!playerName.trim() || !urlGameId || isJoining}
            className="btn-primary w-full text-base"
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Joining…
              </span>
            ) : (
              '🎮 Join Game'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-indigo-500 text-xs mt-6">
        Don't have an invite? <a href="/" className="text-violet-400 hover:text-violet-300 underline">Create your own game</a>
      </p>
    </PageWrapper>
  )
}

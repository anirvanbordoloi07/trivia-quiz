import React, { useEffect, useState } from 'react'
import useGameStore from '../store/gameStore'
import useSocket from '../hooks/useSocket'
import PageWrapper from '../components/PageWrapper'
import clsx from 'clsx'

const GAME_LENGTHS = [5, 10, 15]

export default function HomePage() {
  const [playerName, setPlayerName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const { gameLength, setGameLength, setMyName, myRole, error } = useGameStore()
  const { createGame } = useSocket()

  useEffect(() => {
    if (myRole || error) {
      setIsCreating(false)
    }
  }, [myRole, error])

  const handleCreate = (e) => {
    e.preventDefault()
    if (!playerName.trim()) return
    setIsCreating(true)
    setMyName(playerName.trim())
    createGame({ playerName: playerName.trim(), gameLength })
  }

  return (
    <PageWrapper showScoreboard={false}>
      <div className="animate-fade-in">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3 animate-bounce-slow">🧠</div>
          <h2 className="text-4xl font-black text-gradient mb-2">Trivia Duel</h2>
          <p className="text-indigo-300 text-base">
            Challenge a friend with your own custom trivia questions!
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-indigo-400">
            <span>✓ No registration</span>
            <span>✓ Real-time multiplayer</span>
            <span>✓ Custom questions</span>
          </div>
        </div>

        {/* Create Game Card */}
        <div className="card-glow animate-slide-up">
          <h3 className="text-lg font-bold text-white mb-1">Create a Game</h3>
          <p className="text-indigo-400 text-sm mb-5">You'll be Player 1 — the first to ask a question.</p>

          <form onSubmit={handleCreate} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your display name"
                className="input-field"
                maxLength={20}
                autoFocus
              />
            </div>

            {/* Game length */}
            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                Questions Per Player
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GAME_LENGTHS.map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setGameLength(len)}
                    className={clsx(
                      'py-3 rounded-xl font-bold text-lg border-2 transition-all duration-200',
                      gameLength === len
                        ? 'border-violet-500 bg-violet-700/50 text-white shadow-lg shadow-violet-900/30'
                        : 'border-indigo-700/50 bg-indigo-900/30 text-indigo-300 hover:border-indigo-500 hover:text-white'
                    )}
                  >
                    {len}
                    <span className="block text-xs font-normal opacity-70">questions</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!playerName.trim() || isCreating}
              className="btn-primary w-full text-base"
            >
              {isCreating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Game…
                </span>
              ) : (
                '🚀 Create Game'
              )}
            </button>
          </form>
        </div>

        {/* How to play */}
        <div className="mt-6 card py-4">
          <h4 className="text-sm font-bold text-indigo-300 mb-3 uppercase tracking-wider">How It Works</h4>
          <div className="space-y-2">
            {[
              { icon: '1️⃣', text: 'Player 1 creates a game and gets a shareable link' },
              { icon: '2️⃣', text: 'Player 2 joins using the link' },
              { icon: '✍️', text: 'Take turns writing questions with 4 answer choices' },
              { icon: '⏱️', text: 'Answerer has 30 seconds — correct = 1pt, wrong = questioner gets 1pt' },
              { icon: '🏆', text: 'Highest score after all rounds wins!' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span className="text-indigo-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}

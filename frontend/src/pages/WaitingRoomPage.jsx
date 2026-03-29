import React, { useState } from 'react'
import useGameStore from '../store/gameStore'
import useSocket from '../hooks/useSocket'
import PageWrapper from '../components/PageWrapper'

function PlayerSlot({ player, label, isMe }) {
  if (!player) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-indigo-700/50 bg-indigo-900/20">
        <div className="w-10 h-10 rounded-full bg-indigo-800/50 flex items-center justify-center">
          <span className="text-indigo-500 text-lg animate-pulse">?</span>
        </div>
        <div>
          <p className="text-indigo-500 text-sm font-medium">{label}</p>
          <p className="text-indigo-600 text-xs">Waiting to join…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-emerald-700/60 bg-emerald-900/20">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
        <span className="text-white font-bold text-base">
          {player.name?.[0]?.toUpperCase() || '?'}
        </span>
      </div>
      <div className="flex-1">
        <p className="text-white font-semibold text-sm">
          {player.name}
          {isMe && <span className="ml-2 text-xs text-violet-400 font-normal">(you)</span>}
        </p>
        <p className="text-emerald-400 text-xs">{label} · Ready ✓</p>
      </div>
    </div>
  )
}

export default function WaitingRoomPage() {
  const { gameId, shareLink, player1, player2, gameLength, myRole, myName } = useGameStore()
  const { startGame } = useSocket()
  const [copied, setCopied] = useState(false)

  const isPlayer1 = myRole === 'player1'
  const bothConnected = !!(player1 && player2)

  const handleCopy = () => {
    const link = shareLink || `${window.location.origin}/join/${gameId}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleStart = () => {
    startGame({ gameId })
  }

  return (
    <PageWrapper showScoreboard={false}>
      <div className="animate-fade-in">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⏳</div>
          <h2 className="text-2xl font-black text-white mb-1">Waiting Room</h2>
          <p className="text-indigo-400 text-sm">
            {bothConnected ? 'Both players connected! Ready to start.' : 'Waiting for Player 2 to join…'}
          </p>
        </div>

        <div className="card-glow space-y-4">
          {/* Game info */}
          <div className="flex items-center justify-between text-sm">
            <div className="bg-indigo-900/50 rounded-lg px-3 py-1.5">
              <span className="text-indigo-400">Game ID: </span>
              <span className="text-white font-mono font-medium">{gameId}</span>
            </div>
            <div className="bg-violet-900/50 border border-violet-700/50 rounded-lg px-3 py-1.5">
              <span className="text-violet-300 font-semibold">{gameLength} questions</span>
              <span className="text-violet-400 text-xs"> per player</span>
            </div>
          </div>

          {/* Players */}
          <div className="space-y-2">
            <PlayerSlot
              player={player1}
              label="Player 1 · Asks first"
              isMe={myName === player1?.name}
            />
            <div className="flex items-center justify-center">
              <span className="text-indigo-500 text-xs font-medium px-3">VS</span>
            </div>
            <PlayerSlot
              player={player2}
              label="Player 2 · Answers first"
              isMe={myName === player2?.name}
            />
          </div>

          {/* Share link (only for P1, only if P2 not yet joined) */}
          {isPlayer1 && !player2 && (
            <div>
              <p className="text-indigo-400 text-xs mb-2 font-medium">Share this link with Player 2:</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-indigo-900/50 border border-indigo-700/50 rounded-lg px-3 py-2 text-xs text-indigo-300 font-mono truncate">
                  {shareLink || `${window.location.origin}/join/${gameId}`}
                </div>
                <button
                  onClick={handleCopy}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    copied
                      ? 'bg-emerald-700 text-emerald-200'
                      : 'bg-violet-700 hover:bg-violet-600 text-white'
                  }`}
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Status indicator when waiting */}
          {!bothConnected && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-violet-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-indigo-400 text-sm">Waiting for opponent…</span>
            </div>
          )}

          {/* Start button (P1 only, both connected) */}
          {isPlayer1 && bothConnected && (
            <button
              onClick={handleStart}
              className="btn-primary w-full text-base mt-2"
            >
              🎮 Start Game!
            </button>
          )}

          {/* P2 waiting message */}
          {!isPlayer1 && bothConnected && (
            <div className="text-center py-2">
              <p className="text-indigo-300 text-sm">Waiting for Player 1 to start the game…</p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

import React from 'react'
import useGameStore from '../store/gameStore'
import clsx from 'clsx'

function PlayerScore({ name, score, isActive, label }) {
  return (
    <div className={clsx(
      'flex flex-col items-center px-4 py-2 rounded-xl transition-all duration-300',
      isActive
        ? 'bg-violet-700/40 border border-violet-500/60 shadow-lg shadow-violet-900/30'
        : 'bg-indigo-900/30 border border-indigo-700/30'
    )}>
      <span className={clsx(
        'text-xs font-semibold uppercase tracking-wider mb-0.5',
        isActive ? 'text-violet-300' : 'text-indigo-400'
      )}>
        {label}
      </span>
      <span className={clsx(
        'font-bold text-sm truncate max-w-[80px] text-center',
        isActive ? 'text-white' : 'text-indigo-200'
      )}>
        {name || '—'}
      </span>
      <span className={clsx(
        'text-2xl font-black mt-0.5',
        isActive ? 'text-gradient' : 'text-indigo-300'
      )}>
        {score}
      </span>
    </div>
  )
}

export default function Scoreboard() {
  const {
    player1, player2, scores, roundNumber, totalRounds,
    currentQuestioner, phase,
  } = useGameStore()

  if (phase === 'idle' || phase === 'lobby' || phase === 'joining' || !player1) {
    return null
  }

  const questionsLeft = Math.max(0, totalRounds - roundNumber + 1)

  return (
    <div className="w-full max-w-lg mx-auto mb-4">
      <div className="card py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <PlayerScore
            name={player1?.name}
            score={scores.player1}
            isActive={currentQuestioner === player1?.name}
            label="Player 1"
          />

          <div className="flex flex-col items-center flex-1 px-2">
            <span className="text-indigo-400 text-xs font-medium uppercase tracking-wider">
              Round
            </span>
            <span className="text-white text-xl font-black">
              {roundNumber > 0 ? roundNumber : '—'}
              <span className="text-indigo-400 text-sm font-normal">/{totalRounds || '?'}</span>
            </span>
            {phase !== 'waiting-room' && phase !== 'game-over' && (
              <span className="text-violet-400 text-xs mt-0.5">
                {questionsLeft} left
              </span>
            )}
          </div>

          <PlayerScore
            name={player2?.name}
            score={scores.player2}
            isActive={currentQuestioner === player2?.name}
            label="Player 2"
          />
        </div>
      </div>
    </div>
  )
}

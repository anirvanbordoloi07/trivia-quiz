import React from 'react'
import useGameStore from '../store/gameStore'

export default function ConnectionStatus() {
  const { connected } = useGameStore()

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
      <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )
}

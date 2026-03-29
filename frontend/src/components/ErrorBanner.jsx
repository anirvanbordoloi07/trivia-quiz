import React from 'react'
import useGameStore from '../store/gameStore'

export default function ErrorBanner() {
  const { error, clearError } = useGameStore()

  if (!error) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-slide-up">
      <div className="bg-red-900/90 border border-red-500/60 rounded-xl px-4 py-3 flex items-start gap-3 shadow-xl shadow-red-900/40">
        <span className="text-red-400 text-lg flex-shrink-0">⚠</span>
        <p className="text-red-200 text-sm flex-1">{error}</p>
        <button
          onClick={clearError}
          className="text-red-400 hover:text-white transition-colors flex-shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}

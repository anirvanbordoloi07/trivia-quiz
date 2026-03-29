import React from 'react'
import Scoreboard from './Scoreboard'
import ErrorBanner from './ErrorBanner'

export default function PageWrapper({ children, showScoreboard = true }) {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <ErrorBanner />

      {/* Logo */}
      <div className="mb-4 flex items-center gap-2 select-none">
        <span className="text-2xl">🧠</span>
        <h1 className="text-xl font-black text-gradient tracking-tight">Trivia Duel</h1>
      </div>

      {showScoreboard && <Scoreboard />}

      <div className="w-full max-w-lg">
        {children}
      </div>
    </div>
  )
}

import React from 'react'
import useGameStore from '../store/gameStore'
import PageWrapper from '../components/PageWrapper'

export default function QuestionerWaitingPage() {
  const { currentAnswerer, question, roundNumber, totalRounds } = useGameStore()

  return (
    <PageWrapper>
      <div className="animate-fade-in text-center">
        <div className="card-glow py-10 space-y-5">
          {/* Animated waiting indicator */}
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-800/30" />
            <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl">🎯</span>
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 bg-violet-700/30 border border-violet-600/40 rounded-full px-4 py-1.5 mb-3">
              <span className="text-violet-300 text-xs font-semibold uppercase tracking-wider">Round {roundNumber} of {totalRounds}</span>
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Question Sent!</h2>
            <p className="text-indigo-300 text-base">
              <span className="text-amber-300 font-semibold">{currentAnswerer}</span> is thinking…
            </p>
          </div>

          {/* Question preview */}
          {question && (
            <div className="bg-indigo-900/40 border border-indigo-700/40 rounded-xl p-4 text-left">
              <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">Your Question</p>
              <p className="text-white text-sm font-medium">{question}</p>
            </div>
          )}

          {/* Animated dots */}
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>

          <p className="text-indigo-500 text-xs">
            The reveal happens automatically after they answer
          </p>
        </div>
      </div>
    </PageWrapper>
  )
}

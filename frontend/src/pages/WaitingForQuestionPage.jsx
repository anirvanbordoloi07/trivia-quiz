import React from 'react'
import useGameStore from '../store/gameStore'
import PageWrapper from '../components/PageWrapper'

const WAITING_MESSAGES = [
  "Hmm, what will they ask? 🤔",
  "Get ready to think fast! ⚡",
  "Hope it's not too tricky… 😅",
  "Your opponent is brewing something devious 🧪",
  "Stretching your brain cells… 🧠",
]

export default function WaitingForQuestionPage() {
  const { currentQuestioner, roundNumber, totalRounds } = useGameStore()

  const randomMessage = WAITING_MESSAGES[Math.floor(Math.random() * WAITING_MESSAGES.length)]

  return (
    <PageWrapper>
      <div className="animate-fade-in">
        <div className="card-glow text-center py-10">
          {/* Animated spinner */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-800/50" />
            <div className="absolute inset-0 rounded-full border-4 border-t-violet-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">⏳</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 bg-violet-700/30 border border-violet-600/40 rounded-full px-4 py-1.5 mb-4">
            <span className="text-violet-300 text-xs font-semibold uppercase tracking-wider">Round {roundNumber} of {totalRounds}</span>
          </div>

          <h2 className="text-2xl font-black text-white mb-2">Get Ready!</h2>

          <p className="text-indigo-300 text-base mb-1">
            <span className="text-violet-300 font-semibold">{currentQuestioner}</span> is writing a question for you…
          </p>

          <p className="text-indigo-500 text-sm italic mt-4">{randomMessage}</p>

          {/* Animated dots */}
          <div className="flex items-center justify-center gap-1.5 mt-6">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        </div>

        <p className="text-center text-indigo-500 text-xs mt-4">
          The question will appear automatically — stay sharp!
        </p>
      </div>
    </PageWrapper>
  )
}

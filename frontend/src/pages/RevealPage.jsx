import React from 'react'
import useGameStore from '../store/gameStore'
import useSocket from '../hooks/useSocket'
import PageWrapper from '../components/PageWrapper'
import clsx from 'clsx'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

function RevealCountdown({ count }) {
  return (
    <div className="flex flex-col items-center gap-1 mb-4">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-3 border-indigo-800/50" />
        <div
          className="absolute inset-0 rounded-full border-3 border-t-violet-500 animate-spin"
          style={{ borderWidth: '3px' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-violet-300">{count}</span>
        </div>
      </div>
      <span className="text-indigo-400 text-xs">Revealing in…</span>
    </div>
  )
}

export default function RevealPage() {
  const {
    gameId, revealData, revealCountdown,
    choices, question, myName, currentAnswerer,
    roundNumber, totalRounds,
  } = useGameStore()
  const { nextRound } = useSocket()
  // revealCountdown is now driven by server-emitted reveal-countdown events via useSocket
  const hasRevealed = revealData && revealCountdown <= 0

  const handleNextRound = () => {
    nextRound({ gameId })
  }

  if (!revealData) return null

  const { correctAnswer, answererChoice, answererCorrect, pointsAwarded, scores } = revealData
  const isAnswerer = myName === currentAnswerer

  const choiceList = choices
    ? CHOICE_LABELS.map((label, i) => ({
        label,
        text: Array.isArray(choices) ? choices[i] : choices[label],
      }))
    : []

  return (
    <PageWrapper>
      <div className="animate-fade-in space-y-4">
        {/* Suspense phase */}
        {!hasRevealed && (
          <div className="card-glow text-center py-8">
            <RevealCountdown count={revealCountdown} />
            <h2 className="text-2xl font-black text-white mb-2">Drumroll…</h2>
            <p className="text-indigo-400 text-sm">
              {answererChoice
                ? `Answer submitted — revealing in ${revealCountdown}s`
                : `Time's up — revealing in ${revealCountdown}s`
              }
            </p>
            <div className="flex justify-center gap-1.5 mt-4">
              {[0,1,2,3].map(i => (
                <span key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Reveal phase */}
        {hasRevealed && (
          <>
            {/* Result banner */}
            <div className={clsx(
              'card py-5 text-center animate-pop',
              answererCorrect
                ? 'border-emerald-600/60 bg-emerald-950/40 glow-green'
                : 'border-red-600/60 bg-red-950/40 glow-red'
            )}>
              <div className="text-5xl mb-2">
                {answererCorrect ? '🎉' : '😬'}
              </div>
              <h2 className={clsx(
                'text-2xl font-black mb-1',
                answererCorrect ? 'text-emerald-300' : 'text-red-300'
              )}>
                {answererCorrect ? 'Correct!' : (answererChoice ? 'Wrong Answer' : "Time's Up!")}
              </h2>
              <p className="text-sm text-indigo-300">
                {answererCorrect
                  ? `${currentAnswerer} earns 1 point`
                  : `${currentAnswerer} missed it — questioner earns 1 point`
                }
              </p>
            </div>

            {/* Question recap */}
            {question && (
              <div className="card py-4">
                <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">The Question</p>
                <p className="text-white text-sm font-medium">{question}</p>
              </div>
            )}

            {/* Choices with reveal */}
            {choiceList.length > 0 && (
              <div className="space-y-2">
                {choiceList.map(({ label, text }) => {
                  const isCorrect = label === correctAnswer
                  const isAnswerersChoice = label === answererChoice
                  const isWrong = isAnswerersChoice && !isCorrect

                  return (
                    <div
                      key={label}
                      className={clsx(
                        'flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all',
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-900/30 shadow-lg shadow-emerald-900/20'
                          : isWrong
                          ? 'border-red-500 bg-red-900/30'
                          : 'border-indigo-800/30 bg-indigo-950/30 opacity-60'
                      )}
                    >
                      <span className={clsx(
                        'choice-label text-white',
                        isCorrect ? 'bg-emerald-600' : isWrong ? 'bg-red-600' : 'bg-indigo-800/70'
                      )}>
                        {isCorrect ? '✓' : isWrong ? '✗' : label}
                      </span>
                      <span className={clsx(
                        'text-sm flex-1',
                        isCorrect ? 'text-emerald-200 font-semibold' : isWrong ? 'text-red-300' : 'text-indigo-400'
                      )}>
                        {text}
                      </span>
                      <div className="flex gap-1">
                        {isCorrect && <span className="text-xs bg-emerald-700/60 text-emerald-200 px-2 py-0.5 rounded-full">Correct</span>}
                        {isAnswerersChoice && !isCorrect && <span className="text-xs bg-red-700/60 text-red-200 px-2 py-0.5 rounded-full">Your answer</span>}
                        {isAnswerersChoice && isCorrect && <span className="text-xs bg-blue-700/60 text-blue-200 px-2 py-0.5 rounded-full">Your answer</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Points awarded */}
            {pointsAwarded && (
              <div className="card py-3 text-center">
                <p className="text-indigo-400 text-xs font-medium uppercase tracking-wider mb-1">Points This Round</p>
                <div className="flex items-center justify-center gap-4 text-sm">
                  {Object.entries(pointsAwarded).map(([player, pts]) => (
                    pts > 0 && (
                      <div key={player} className="flex items-center gap-1.5">
                        <span className="text-violet-300 font-semibold">{player}</span>
                        <span className="text-emerald-400 font-bold">+{pts}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Next round button */}
            <button
              onClick={handleNextRound}
              className="btn-primary w-full text-base"
            >
              {roundNumber >= totalRounds ? '🏁 See Final Results' : '➡️ Next Round'}
            </button>
          </>
        )}
      </div>
    </PageWrapper>
  )
}

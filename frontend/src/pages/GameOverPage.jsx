import React from 'react'
import useGameStore from '../store/gameStore'
import useSocket from '../hooks/useSocket'
import PageWrapper from '../components/PageWrapper'
import clsx from 'clsx'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

function ConfettiDot({ color, style }) {
  return (
    <div
      className={`absolute w-2 h-2 rounded-full ${color} opacity-70`}
      style={style}
    />
  )
}

export default function GameOverPage() {
  const {
    scores,
    player1,
    player2,
    myName,
    gameId,
    winner,
    completedRounds,
    resetGame,
  } = useGameStore()
  const { playAgain, newGame } = useSocket()

  const isTie = !winner || winner === 'tie'
  const isWinner = winner === myName
  const isLoser = !isWinner && !isTie

  const p1Score = scores.player1 ?? 0
  const p2Score = scores.player2 ?? 0
  const maxScore = Math.max(p1Score, p2Score, 1)

  const handlePlayAgain = () => {
    playAgain({ gameId })
  }

  const handleNewGame = () => {
    newGame()
    resetGame()
    window.location.href = '/'
  }

  const handleShareResults = async () => {
    const summaryLines = [
      `Trivia Duel result: ${player1?.name || 'Player 1'} ${p1Score} - ${p2Score} ${player2?.name || 'Player 2'}`,
      isTie ? 'Result: tie game.' : `Winner: ${winner}.`,
      `Rounds played: ${completedRounds.length}.`,
    ]
    const summaryText = summaryLines.join('\n')

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Trivia Duel Results',
          text: summaryText,
        })
        return
      } catch (_error) {
        // Fall through to clipboard copy if share is cancelled or unavailable.
      }
    }

    await navigator.clipboard.writeText(summaryText)
  }

  return (
    <PageWrapper showScoreboard={false}>
      <div className="animate-fade-in space-y-5">
        {/* Winner banner */}
        <div className={clsx(
          'card-glow text-center py-8 relative overflow-hidden',
          isWinner && 'border-yellow-600/60 glow-purple',
          isLoser && 'border-indigo-700/40',
          isTie && 'border-cyan-700/60',
        )}>
          {/* Background confetti dots */}
          {isWinner && (
            <div className="absolute inset-0 pointer-events-none">
              {['bg-yellow-400','bg-violet-400','bg-pink-400','bg-cyan-400','bg-emerald-400'].map((color, i) => (
                <ConfettiDot key={i} color={color} style={{
                  left: `${15 + i * 18}%`,
                  top: `${10 + (i % 3) * 25}%`,
                  animation: `bounce ${1 + i * 0.2}s infinite`,
                  animationDelay: `${i * 0.1}s`,
                }} />
              ))}
            </div>
          )}

          <div className="text-6xl mb-3 animate-bounce-slow">
            {isTie ? '🤝' : isWinner ? '🏆' : '🥈'}
          </div>

          <h2 className={clsx(
            'text-3xl font-black mb-1',
            isWinner && 'text-gradient-gold',
            isLoser && 'text-indigo-200',
            isTie && 'text-cyan-300',
          )}>
            {isTie ? "It's a Tie!" : isWinner ? 'You Won!' : `${winner} Wins!`}
          </h2>

          <p className={clsx(
            'text-sm',
            isWinner && 'text-yellow-300',
            isLoser && 'text-indigo-400',
            isTie && 'text-cyan-400',
          )}>
            {isTie ? 'A perfectly balanced battle of wits' : isWinner ? 'Amazing trivia skills!' : 'Better luck next round!'}
          </p>
        </div>

        {/* Score breakdown */}
        <div className="card">
          <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-4 text-center">
            Final Scores
          </h3>

          <div className="space-y-4">
            {[
              { player: player1, score: p1Score, key: 'player1' },
              { player: player2, score: p2Score, key: 'player2' },
            ].map(({ player, score, key }) => {
              const isThisWinner = player?.name === winner
              const barWidth = `${Math.round((score / maxScore) * 100)}%`

              return (
                <div key={key} className={clsx(
                  'p-4 rounded-xl border',
                  isThisWinner
                    ? 'border-yellow-600/50 bg-yellow-950/20'
                    : 'border-indigo-800/40 bg-indigo-950/20'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isThisWinner && <span className="text-yellow-400">👑</span>}
                      <span className={clsx(
                        'font-bold',
                        isThisWinner ? 'text-yellow-300' : 'text-indigo-200'
                      )}>
                        {player?.name || '—'}
                      </span>
                      {player?.name === myName && (
                        <span className="text-xs text-indigo-500">(you)</span>
                      )}
                    </div>
                    <span className={clsx(
                      'text-2xl font-black',
                      isThisWinner ? 'text-gradient-gold' : 'text-indigo-300'
                    )}>
                      {score}
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="h-2 bg-indigo-900/50 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-700',
                        isThisWinner ? 'bg-gradient-to-r from-yellow-500 to-amber-400' : 'bg-gradient-to-r from-indigo-600 to-violet-600'
                      )}
                      style={{ width: barWidth }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {completedRounds.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">
                  Round Review
                </h3>
                <p className="text-indigo-500 text-xs mt-1">
                  Expand each round to revisit the question, answers, and outcome.
                </p>
              </div>
              <button onClick={handleShareResults} className="btn-secondary text-sm py-2 px-4">
                Share Result
              </button>
            </div>

            <div className="space-y-3">
              {completedRounds.map((round) => (
                <details key={round.roundNumber} className="group rounded-xl border border-indigo-800/40 bg-indigo-950/30 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Round {round.roundNumber}: {round.questionerName} asked {round.answererName}
                      </p>
                      <p className="text-xs text-indigo-400 mt-1">
                        {round.answererCorrect ? `${round.answererName} answered correctly.` : `${round.answererName} missed it.`}
                      </p>
                    </div>
                    <span className="text-xs text-violet-300 group-open:rotate-180 transition-transform">▼</span>
                  </summary>

                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-white font-medium">{round.question}</p>

                    <div className="space-y-2">
                      {CHOICE_LABELS.map((label) => {
                        const choiceText = round.choices?.[label]
                        const isCorrectChoice = round.correctAnswer === label
                        const isPickedChoice = round.answererChoice === label

                        return (
                          <div
                            key={label}
                            className={clsx(
                              'rounded-lg border px-3 py-2 text-sm',
                              isCorrectChoice
                                ? 'border-emerald-600/50 bg-emerald-950/20 text-emerald-200'
                                : isPickedChoice
                                ? 'border-red-600/50 bg-red-950/20 text-red-200'
                                : 'border-indigo-800/40 bg-indigo-950/30 text-indigo-300'
                            )}
                          >
                            <span className="font-semibold mr-2">{label}.</span>
                            {choiceText}
                            {isCorrectChoice && <span className="ml-2 text-xs text-emerald-300">Correct</span>}
                            {isPickedChoice && !isCorrectChoice && <span className="ml-2 text-xs text-red-300">Picked</span>}
                          </div>
                        )
                      })}
                    </div>

                    <p className="text-xs text-indigo-400">
                      {round.answererChoice
                        ? `${round.answererName} selected ${round.answererChoice}.`
                        : `${round.answererName} timed out.`
                      }
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={handlePlayAgain} className="btn-primary text-sm">
            🔄 Play Again
          </button>
          <button onClick={handleShareResults} className="btn-secondary text-sm">
            📋 Share Result
          </button>
          <button onClick={handleNewGame} className="btn-secondary text-sm">
            🏠 New Game
          </button>
        </div>

        <p className="text-center text-indigo-600 text-xs">
          "Play Again" restarts with the same players · "New Game" goes back to the home screen
        </p>
      </div>
    </PageWrapper>
  )
}

import React, { useCallback } from 'react'
import useGameStore from '../store/gameStore'
import useSocket from '../hooks/useSocket'
import PageWrapper from '../components/PageWrapper'
import CountdownTimer from '../components/CountdownTimer'
import clsx from 'clsx'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']
const CHOICE_ACCENTS = {
  A: { default: 'from-purple-600/20 to-violet-600/10 hover:from-purple-600/40', selected: 'from-purple-700/50 to-violet-700/40 border-purple-400', label: 'bg-purple-600' },
  B: { default: 'from-blue-600/20 to-indigo-600/10 hover:from-blue-600/40',   selected: 'from-blue-700/50 to-indigo-700/40 border-blue-400',   label: 'bg-blue-600' },
  C: { default: 'from-cyan-600/20 to-teal-600/10 hover:from-cyan-600/40',     selected: 'from-cyan-700/50 to-teal-700/40 border-cyan-400',     label: 'bg-cyan-600' },
  D: { default: 'from-orange-600/20 to-amber-600/10 hover:from-orange-600/40',selected: 'from-orange-700/50 to-amber-700/40 border-orange-400',label: 'bg-orange-500' },
}

export default function AnsweringPage() {
  const {
    gameId, question, choices, selectedAnswer, selectAnswer,
    roundNumber, totalRounds, currentQuestioner, timeLeft,
    answerSubmitted, setAnswerSubmitted, setTimerActive,
  } = useGameStore()
  const { submitAnswer, submitTimeout } = useSocket()

  const handleSelect = (label) => {
    if (answerSubmitted) return
    selectAnswer(label)
  }

  const handleSubmit = () => {
    if (!selectedAnswer || answerSubmitted) return
    setAnswerSubmitted(true)
    setTimerActive(false)
    submitAnswer({ gameId, answer: selectedAnswer })
  }

  const handleTimeUp = useCallback(() => {
    submitTimeout()
  }, [submitTimeout])

  const choiceList = choices
    ? CHOICE_LABELS.map((label, i) => ({
        label,
        text: Array.isArray(choices) ? choices[i] : choices[label],
      }))
    : []

  const urgency = timeLeft <= 5 ? 'red' : timeLeft <= 10 ? 'amber' : 'green'

  return (
    <PageWrapper>
      <div className="animate-slide-up space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 bg-violet-700/30 border border-violet-600/40 rounded-full px-3 py-1 mb-1">
              <span className="text-violet-300 text-xs font-semibold uppercase tracking-wider">Round {roundNumber}/{totalRounds}</span>
            </div>
            <p className="text-indigo-400 text-xs">
              Question by <span className="text-violet-300 font-semibold">{currentQuestioner}</span>
            </p>
          </div>

          <CountdownTimer onTimeUp={handleTimeUp} />
        </div>

        {/* Question card */}
        <div className={clsx(
          'card py-5 transition-all duration-300',
          urgency === 'red' && 'border-red-700/40 shadow-red-900/20',
          urgency === 'amber' && 'border-amber-700/40',
        )}>
          <p className="text-white text-lg font-semibold leading-snug text-center">
            {question}
          </p>
        </div>

        {/* Choices */}
        <div className="space-y-2">
          {choiceList.map(({ label, text }) => {
            const accent = CHOICE_ACCENTS[label]
            const isSelected = selectedAnswer === label
            const isDisabled = answerSubmitted || (!!selectedAnswer && !isSelected)

            return (
              <button
                key={label}
                onClick={() => handleSelect(label)}
                disabled={isDisabled}
                className={clsx(
                  'w-full text-left p-4 rounded-xl border-2 transition-all duration-200 font-medium flex items-center gap-3',
                  'bg-gradient-to-r',
                  isSelected
                    ? `${accent.selected} shadow-lg`
                    : isDisabled
                    ? 'border-indigo-800/30 from-indigo-950/30 to-indigo-950/30 opacity-50 cursor-not-allowed'
                    : `border-indigo-700/50 ${accent.default} cursor-pointer hover:-translate-y-0.5`
                )}
              >
                <span className={clsx(
                  'choice-label text-white flex-shrink-0',
                  isSelected ? accent.label : 'bg-indigo-800/70'
                )}>
                  {isSelected ? '✓' : label}
                </span>
                <span className={clsx(
                  'flex-1 text-sm',
                  isSelected ? 'text-white' : 'text-indigo-200'
                )}>
                  {text}
                </span>
              </button>
            )
          })}
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!selectedAnswer || answerSubmitted}
          className="btn-primary w-full text-base"
        >
          {answerSubmitted
            ? 'Answer Submitted'
            : selectedAnswer
            ? `Submit Answer (${selectedAnswer})`
            : 'Select an answer above'}
        </button>

        {selectedAnswer && !answerSubmitted && (
          <p className="text-center text-indigo-400 text-xs">
            You selected <strong className="text-violet-300">Choice {selectedAnswer}</strong> — hit submit to confirm
          </p>
        )}
      </div>
    </PageWrapper>
  )
}

import React, { useState } from 'react'
import useGameStore from '../store/gameStore'
import useSocket from '../hooks/useSocket'
import PageWrapper from '../components/PageWrapper'
import clsx from 'clsx'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']
const CHOICE_COLORS = {
  A: 'from-purple-600 to-violet-600',
  B: 'from-blue-600 to-indigo-600',
  C: 'from-cyan-600 to-teal-600',
  D: 'from-orange-600 to-amber-600',
}

export default function QuestionAuthoringPage() {
  const { gameId, currentAnswerer, roundNumber, totalRounds } = useGameStore()
  const { submitQuestion } = useSocket()

  const [questionText, setQuestionText] = useState('')
  const [choices, setChoices] = useState({ A: '', B: '', C: '', D: '' })
  const [correctAnswer, setCorrectAnswer] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allFilled = questionText.trim() && CHOICE_LABELS.every(l => choices[l].trim()) && correctAnswer

  const handleChoiceChange = (label, value) => {
    setChoices(prev => ({ ...prev, [label]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!allFilled || isSubmitting) return
    setIsSubmitting(true)
    submitQuestion({
      gameId,
      question: questionText.trim(),
      choices: { A: choices.A.trim(), B: choices.B.trim(), C: choices.C.trim(), D: choices.D.trim() },
      correctAnswer,
    })
  }

  return (
    <PageWrapper>
      <div className="animate-slide-up">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 bg-violet-700/30 border border-violet-600/40 rounded-full px-4 py-1.5 mb-3">
            <span className="text-violet-300 text-xs font-semibold uppercase tracking-wider">Round {roundNumber} of {totalRounds}</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-1">Write Your Question</h2>
          <p className="text-indigo-400 text-sm">
            <span className="text-violet-300 font-semibold">{currentAnswerer}</span> will answer this
          </p>
        </div>

        <div className="card-glow">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Question text */}
            <div>
              <label className="block text-sm font-semibold text-indigo-200 mb-1.5">
                Question <span className="text-red-400">*</span>
              </label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Type your trivia question here…"
                className="input-field resize-none h-20"
                maxLength={300}
                autoFocus
              />
              <p className="text-right text-indigo-500 text-xs mt-1">{questionText.length}/300</p>
            </div>

            {/* Answer choices */}
            <div>
              <label className="block text-sm font-semibold text-indigo-200 mb-2">
                Answer Choices <span className="text-red-400">*</span>
              </label>
              <p className="text-xs text-indigo-500 mb-3">Fill all 4 options, then click one to mark it as correct.</p>

              <div className="space-y-2">
                {CHOICE_LABELS.map((label) => (
                  <div key={label} className="flex items-center gap-2">
                    {/* Choice label badge */}
                    <button
                      type="button"
                      onClick={() => setCorrectAnswer(label)}
                      className={clsx(
                        'flex-shrink-0 w-9 h-9 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center',
                        correctAnswer === label
                          ? `bg-gradient-to-br ${CHOICE_COLORS[label]} text-white shadow-lg scale-110`
                          : 'bg-indigo-800/50 text-indigo-400 hover:text-white hover:bg-indigo-700/60 border border-indigo-700/50'
                      )}
                      title={`Mark ${label} as correct`}
                    >
                      {correctAnswer === label ? '✓' : label}
                    </button>

                    {/* Text input */}
                    <input
                      type="text"
                      value={choices[label]}
                      onChange={(e) => handleChoiceChange(label, e.target.value)}
                      placeholder={`Choice ${label}`}
                      className={clsx(
                        'input-field flex-1',
                        correctAnswer === label && 'border-emerald-600/60 bg-emerald-950/30'
                      )}
                      maxLength={150}
                    />
                  </div>
                ))}
              </div>

              {/* Correct answer indicator */}
              {correctAnswer && (
                <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1">
                  <span>✓</span> Correct answer: <strong>Choice {correctAnswer}</strong>
                </p>
              )}
              {!correctAnswer && (
                <p className="text-amber-500 text-xs mt-2">
                  Click a choice label (A/B/C/D) to mark the correct answer
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!allFilled || isSubmitting}
              className="btn-primary w-full text-base"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending Question…
                </span>
              ) : (
                '📤 Send Question'
              )}
            </button>
          </form>
        </div>

        {/* Tip */}
        <div className="mt-4 text-center">
          <p className="text-indigo-500 text-xs">
            💡 Tip: The correct answer is never shown to your opponent until after they answer
          </p>
        </div>
      </div>
    </PageWrapper>
  )
}

import React, { useEffect, useRef } from 'react'
import useGameStore from '../store/gameStore'
import clsx from 'clsx'

const RADIUS = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const MAX_TIME = 30

export default function CountdownTimer({ onTimeUp }) {
  const { timeLeft, timerActive, setTimeLeft, setTimerActive } = useGameStore()
  const intervalRef = useRef(null)

  useEffect(() => {
    if (timerActive) {
      intervalRef.current = setInterval(() => {
        const store = useGameStore.getState()
        if (store.timeLeft <= 1) {
          clearInterval(intervalRef.current)
          setTimeLeft(0)
          setTimerActive(false)
          onTimeUp?.()
        } else {
          setTimeLeft(store.timeLeft - 1)
        }
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [timerActive]) // eslint-disable-line react-hooks/exhaustive-deps

  const progress = timeLeft / MAX_TIME
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress)

  const urgentColor = timeLeft <= 5
    ? '#ef4444'   // red
    : timeLeft <= 10
    ? '#f59e0b'   // amber
    : '#10b981'   // green

  const bgColor = timeLeft <= 5
    ? 'text-red-400'
    : timeLeft <= 10
    ? 'text-amber-400'
    : 'text-emerald-400'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[72px] h-[72px]">
        {/* Background ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
          <circle
            cx="36" cy="36" r={RADIUS}
            fill="none"
            stroke="rgba(99,102,241,0.2)"
            strokeWidth="5"
          />
          {/* Progress ring */}
          <circle
            cx="36" cy="36" r={RADIUS}
            fill="none"
            stroke={urgentColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
          />
        </svg>

        {/* Time number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={clsx(
            'text-xl font-black transition-colors duration-300',
            bgColor,
            timeLeft <= 5 && 'animate-pulse-fast'
          )}>
            {timeLeft}
          </span>
        </div>
      </div>
      <span className="text-indigo-400 text-xs font-medium">seconds</span>
    </div>
  )
}

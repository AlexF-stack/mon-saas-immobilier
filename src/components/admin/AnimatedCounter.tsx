'use client'

import { useEffect, useRef, useState } from 'react'

type AnimatedCounterProps = {
  value: number
  format: (value: number) => string
  durationMs?: number
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mediaQuery.matches)
    apply()
    mediaQuery.addEventListener('change', apply)
    return () => mediaQuery.removeEventListener('change', apply)
  }, [])

  return reduced
}

export function AnimatedCounter({ value, format, durationMs = 850 }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const previousValueRef = useRef(0)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reducedMotion) {
      const rafId = window.requestAnimationFrame(() => {
        setDisplayValue(value)
        previousValueRef.current = value
      })
      return () => window.cancelAnimationFrame(rafId)
    }

    const startValue = previousValueRef.current
    const delta = value - startValue
    if (delta === 0) {
      const rafId = window.requestAnimationFrame(() => setDisplayValue(value))
      return () => window.cancelAnimationFrame(rafId)
    }

    const startedAt = performance.now()
    let rafId = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs)
      const eased = 1 - (1 - progress) ** 3
      setDisplayValue(startValue + delta * eased)
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick)
      } else {
        previousValueRef.current = value
      }
    }

    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [durationMs, reducedMotion, value])

  return <span className="tabular-nums">{format(displayValue)}</span>
}

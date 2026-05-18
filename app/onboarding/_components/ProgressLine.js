'use client'

import { usePathname } from 'next/navigation'

// Step mapping aligns with [Spec] Prelude Conversation Flow §1 architecture:
// Welcome + 7 conversation turns + Loading/Completion = 9 named steps.
// Screen 7b (own-words, conditional) sits between 7 and 8.
const STEP_BY_PATH = {
  '/onboarding/welcome':    0,
  '/onboarding/history':    1,
  '/onboarding/cross-modal': 2,
  '/onboarding/schedule':   3,
  '/onboarding/equipment':  4,
  '/onboarding/metrics':    5,
  '/onboarding/context':    6,
  '/onboarding/goal':       7,
  '/onboarding/own-words':  7.5,
  '/onboarding/loading':    8,
  '/onboarding/complete':   9,
}
const TOTAL_STEPS = 9

export default function ProgressLine() {
  const pathname = usePathname()
  const step = STEP_BY_PATH[pathname] ?? 0
  const pct = Math.min(100, Math.max(0, (step / TOTAL_STEPS) * 100))
  return (
    <div className="rep-progress-line" aria-hidden="true">
      <div
        className="rep-progress-line__fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

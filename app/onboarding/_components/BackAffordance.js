'use client'

import { useRouter } from 'next/navigation'

/**
 * Back affordance for Prelude screens 1–7b. Secondary control (NOT
 * primary). Per Moment 1 spec, back must be available on every
 * conversation screen except 0 Welcome (no prior), 8 Loading (engine
 * running, no interruption), and 9 Completion (threshold crossed).
 *
 * State preservation: OnboardingContext lives in app/onboarding/layout.js
 * which does not unmount during sub-route navigation. router.push() of
 * the prior route re-renders that screen's inputs from the persisted
 * state. No state-architecture change needed for Back to work.
 *
 * Implementation choice: router.push() with an explicit prior route,
 * rather than router.back(). router.back() would replay browser history
 * — undesirable if the user reached a screen by deep-link or by a path
 * that skipped 7b. Explicit routes keep the conversation linear in both
 * directions.
 *
 * @param {{ to: string, label?: string }} props
 *   to    — the prior screen's pathname (e.g. '/onboarding/history')
 *   label — optional override; defaults to "Back"
 */
export default function BackAffordance({ to, label = 'Back' }) {
  const router = useRouter()
  return (
    <button
      type="button"
      className="rep-back"
      onClick={() => router.push(to)}
      aria-label={`Go back to previous step`}
    >
      <span aria-hidden="true">‹</span> {label}
    </button>
  )
}

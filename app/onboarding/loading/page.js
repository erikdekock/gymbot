'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import ScreenContainer from '../_components/ScreenContainer'
import QuestionHeading from '../_components/QuestionHeading'
import { HelperCopy } from '../_components/Typography'
import LoadingIndicator from '../_components/LoadingIndicator'
import PrimaryButton from '../_components/PrimaryButton'
import ErrorMessage from '../_components/ErrorMessage'

/**
 * Screen 8 — Loading state. 12.3b wires the real engine call here.
 *
 * Flow:
 *   1. On mount, POST the OnboardingState to /api/prelude/complete.
 *   2. The route runs converter+engine and persists to user_program.
 *   3. The returned program is stashed in sessionStorage (the
 *      `__onboarding_program__` key) so Screen 9 can render without an extra
 *      round-trip; on refresh Screen 9 GETs it back from /api/prelude/complete.
 *   4. Once BOTH the API call has resolved AND the minimum visible time has
 *      elapsed, route to /onboarding/complete (Screen 9). The minimum dwell
 *      preserves the reading rhythm of the loading copy when the engine
 *      returns instantly.
 *
 * Spec §2 Screen 8 visual: no spinner, no countdown, no back navigation.
 *
 * Error handling: per the 12.3a "no silent fallback" rule, an engine error
 * surfaces here as an explicit retry CTA — we do NOT serve a templated
 * fallback (the Tier B layer that 12.3b's brief removes).
 */

const STORAGE_KEY = '__onboarding_program__'
const MIN_VISIBLE_MS = 1750
const LATENCY_WARN_MS = 20_000

export default function LoadingPage() {
  const router = useRouter()
  const { state } = useOnboarding()
  const [showLatencyWarn, setShowLatencyWarn] = useState(false)
  const [error, setError] = useState(null)
  const startedAt = useRef(Date.now())
  const fired = useRef(false)

  async function runSubmit() {
    setError(null)
    fired.current = true
    startedAt.current = Date.now()

    let res, json
    try {
      res = await fetch('/api/prelude/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
      json = await res.json()
    } catch (e) {
      setError('Network error. Try again.')
      return
    }
    if (!res.ok || !json.program) {
      setError(json.message || json.error || 'Something went wrong.')
      return
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(json.program))
    } catch {
      // sessionStorage can be unavailable (private-mode iOS). Screen 9 will
      // GET the program back from the API as a fallback — non-fatal here.
    }

    const elapsed = Date.now() - startedAt.current
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
    setTimeout(() => {
      router.push('/onboarding/complete')
    }, remaining)
  }

  useEffect(() => {
    if (fired.current) return
    runSubmit()
    const warn = setTimeout(() => setShowLatencyWarn(true), LATENCY_WARN_MS)
    return () => clearTimeout(warn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ScreenContainer
      top={
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--rep-space-4)' }}>
          <QuestionHeading>Building your first week.</QuestionHeading>
          <HelperCopy>
            We&rsquo;re reading what you told us and setting the loads for Week 1.
          </HelperCopy>
          <div style={{ marginTop: 'var(--rep-space-6)' }}>
            <LoadingIndicator />
          </div>
          {showLatencyWarn && !error ? (
            <HelperCopy>
              Taking a moment longer than expected. We&rsquo;ll get there.
            </HelperCopy>
          ) : null}
          <ErrorMessage message={error} />
        </div>
      }
      bottom={
        error ? <PrimaryButton onClick={runSubmit}>Try Again</PrimaryButton> : null
      }
    />
  )
}

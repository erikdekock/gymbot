'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ScreenContainer from '../_components/ScreenContainer'
import QuestionHeading from '../_components/QuestionHeading'
import { HelperCopy } from '../_components/Typography'
import LoadingIndicator from '../_components/LoadingIndicator'

/**
 * Screen 8 — Loading state.
 *
 * Spec §2 + §7 Screen 8:
 *   Primary: "Building your first week."
 *   Secondary: "We're reading what you told us and setting the loads for Week 1."
 *   Indeterminate forest sage progress indicator.
 *   No back navigation. No spinner. No countdown.
 *   After 20s: latency-warning copy ("Taking a moment longer than expected...")
 *   Failure mode A (>30s): templated week serves seamlessly, user sees no error.
 *
 * 12.2 stub behaviour (Erik 18 May): auto-route to Screen 9 after a
 * short timer so QA isn't blocked by the no-engine state. 12.3 replaces
 * this with the real engine wait.
 */

// 1750ms keeps the loading screen long enough to read the primary copy
// (~3-4 words/sec) but short enough that QA doesn't notice.
const STUB_TIMER_MS = 1750
const LATENCY_WARN_MS = 20_000

export default function LoadingPage() {
  const router = useRouter()
  const [showLatencyWarn, setShowLatencyWarn] = useState(false)

  useEffect(() => {
    const route = setTimeout(() => {
      router.push('/onboarding/complete')
    }, STUB_TIMER_MS)
    const warn = setTimeout(() => {
      setShowLatencyWarn(true)
    }, LATENCY_WARN_MS)
    return () => {
      clearTimeout(route)
      clearTimeout(warn)
    }
  }, [router])

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
          {showLatencyWarn ? (
            <HelperCopy>
              Taking a moment longer than expected. We&rsquo;ll get there.
            </HelperCopy>
          ) : null}
        </div>
      }
    />
  )
}

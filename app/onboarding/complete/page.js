'use client'

import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import {
  getScripted1,
  getYourKeyLine,
  getGoalDisplayName,
} from '../../../lib/onboarding-copy'
import ScreenContainer from '../_components/ScreenContainer'
import Wordmark from '../_components/Wordmark'
import { BodyCopy } from '../_components/Typography'
import PrimaryButton from '../_components/PrimaryButton'

/**
 * Screen 9 — Completion (Scripted #1 surface).
 *
 * Spec §2 + §7 Screen 9 (revised 20 May 2026). Brand mode, full editorial
 * weight. REPRISE wordmark returns to primary position (mirrors auth
 * welcome — threshold crossing).
 *
 * Content:
 * - Scripted #1 (12.2 stub: neutral profile-independent string from
 *   lib/onboarding-copy.js; 12.3 swaps to AI-synthesised canonical text)
 * - "Your Key" sub-line — 12.2 stub returns null so NO Key line renders.
 *   Per revised spec, Your Key is ALWAYS AI-synthesised in 12.3, never
 *   echoed from user_words_goal, never a placeholder. The rejected
 *   verbatim-echo + "name it after a few sessions" patterns are removed.
 * - Single CTA: "Open the Set"
 *
 * Sparse-profile path (spec §8): NOT in 12.2 scope; handled by 12.3 engine.
 */
export default function CompletePage() {
  const router = useRouter()
  const { state } = useOnboarding()

  const goalDisplayName = getGoalDisplayName(state.goal_id)
  const scripted1 = getScripted1({
    userWordsGoal: state.user_words_goal,
    goalDisplayName,
    provisional: state.goal_provisional,
  })
  const yourKey = getYourKeyLine({
    goalDisplayName,
    provisional: state.goal_provisional,
  })

  function openTheSet() {
    // 13 (Moment 2a week-view) is not yet built. Route to app root;
    // middleware honours auth and lands the user on the existing home.
    // 13 will replace this with /week or equivalent.
    router.push('/')
  }

  return (
    <ScreenContainer
      top={
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--rep-space-6)' }}>
          <Wordmark size="primary" />

          <BodyCopy>{scripted1}</BodyCopy>

          {yourKey ? (
            <p
              style={{
                fontFamily: 'var(--rep-font-sans)',
                fontSize: '0.875rem',
                color: 'var(--graphite-30)',
                margin: 0,
              }}
            >
              {yourKey}
            </p>
          ) : null}
        </div>
      }
      bottom={
        <PrimaryButton onClick={openTheSet}>Open the Set</PrimaryButton>
      }
    />
  )
}

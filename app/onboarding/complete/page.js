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
 * Spec §2 + §7 Screen 9. Brand mode, full editorial weight. REPRISE
 * wordmark returns to primary position (mirrors auth welcome — threshold
 * crossing).
 *
 * Content:
 * - Scripted #1 (stubbed in 12.2 from lib/onboarding-copy.js; 12.3 swaps
 *   to KB-derived canonical text)
 * - "Your Key" sub-line (goal display name OR provisional framing)
 * - Single CTA: "Open the Set"
 *
 * Sparse-profile path (spec §8 — completeness_score < 0.3 surfaces
 * assumption list with confirm/correct affordances): NOT in 12.2 scope.
 * Completeness score is computed by the engine in 12.3. Stub renders the
 * standard completion path.
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
        </div>
      }
      bottom={
        <PrimaryButton onClick={openTheSet}>Open the Set</PrimaryButton>
      }
    />
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import ScreenContainer from '../_components/ScreenContainer'
import BackAffordance from '../_components/BackAffordance'
import QuestionHeading from '../_components/QuestionHeading'
import { HelperCopy } from '../_components/Typography'
import PrimaryButton from '../_components/PrimaryButton'
import SkipAffordance from '../_components/SkipAffordance'

/**
 * Screen 7b — Own words (conditional, only if named goal selected).
 *
 * Spec §2 + §7 Screen 7b. Free text, 200 char max. Skip affordance below.
 *
 * AC5 — submit handler is stubbed: logs payload, does NOT call engine.
 * Engine wiring lives in 12.3 (Prelude round-trip + user_program schema).
 */
const MAX_CHARS = 200

export default function OwnWordsPage() {
  const router = useRouter()
  const { state, dispatch } = useOnboarding()

  // Defensive: if user landed here without a named goal, route back to 7
  if (state.goal_provisional || state.goal_id == null) {
    if (typeof window !== 'undefined') {
      router.replace('/onboarding/goal')
    }
    return null
  }

  function setText(v) {
    dispatch({
      type: 'SET_FIELD',
      path: 'user_words_goal',
      value: v.length === 0 ? null : v,
    })
  }

  function handleSubmit() {
    // AC5 stub: log payload, do NOT call engine.
    // 12.3 replaces this with the real engine call.
    // eslint-disable-next-line no-console
    console.log('[Prelude submit — stub]', JSON.parse(JSON.stringify(state)))
    router.push('/onboarding/loading')
  }

  function handleSkip() {
    dispatch({ type: 'SET_FIELD', path: 'user_words_goal', value: null })
    // eslint-disable-next-line no-console
    console.log('[Prelude submit — stub]', JSON.parse(JSON.stringify(state)))
    router.push('/onboarding/loading')
  }

  const value = state.user_words_goal ?? ''
  const remaining = MAX_CHARS - value.length

  return (
    <ScreenContainer
      top={
        <>
          <BackAffordance to="/onboarding/goal" />
          <QuestionHeading>In your own words — what does getting there look like?</QuestionHeading>
          <HelperCopy>We use your phrasing, not ours, when we talk about your direction.</HelperCopy>

          <textarea
            className="rep-num-input"
            style={{
              width: '100%',
              minHeight: '7rem',
              textAlign: 'left',
              fontFamily: 'var(--rep-font-sans)',
              lineHeight: 1.5,
              padding: 'var(--rep-space-3)',
              resize: 'vertical',
            }}
            placeholder="e.g. I want to squat my old numbers again without it taking six months."
            maxLength={MAX_CHARS}
            value={value}
            onChange={(e) => setText(e.target.value)}
            aria-label="Goal in your own words"
          />
          <HelperCopy>{remaining} characters left</HelperCopy>

          <div style={{ marginTop: 'var(--rep-space-3)' }}>
            <SkipAffordance onClick={handleSkip}>Skip this</SkipAffordance>
          </div>
        </>
      }
      bottom={
        <PrimaryButton onClick={handleSubmit}>Continue</PrimaryButton>
      }
    />
  )
}

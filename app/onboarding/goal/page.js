'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import { validateGoal } from '../_state/validators'
import { GOAL_OPTIONS_V1 } from '../../../lib/onboarding-copy'
import ScreenContainer from '../_components/ScreenContainer'
import QuestionHeading from '../_components/QuestionHeading'
import { BodyCopy, HelperCopy } from '../_components/Typography'
import OptionButton from '../_components/OptionButton'
import Separator from '../_components/Separator'
import PrimaryButton from '../_components/PrimaryButton'
import ErrorMessage from '../_components/ErrorMessage'

/**
 * Screen 7 — Goal / Your Key.
 *
 * Named goals (single-select) + visually separated "I'm not sure yet" path.
 *
 * Per CEO direction 13 May 2026: separation is structural (1px surface-70
 * line with centred "Or" label), NOT via color damping. "I'm not sure yet"
 * is rendered with the same text weight as named goals.
 *
 * If user taps "I'm not sure yet", confirmation copy replaces the question
 * inline before moving forward (provisional flag set).
 */

const PROVISIONAL_VALUE = '__provisional__'

export default function GoalPage() {
  const router = useRouter()
  const { state, dispatch } = useOnboarding()
  const [error, setError] = useState(null)
  const [confirmingProvisional, setConfirmingProvisional] = useState(
    state.goal_provisional === true,
  )

  function selectNamed(goalId) {
    setError(null)
    setConfirmingProvisional(false)
    dispatch({
      type: 'SET_FIELDS',
      fields: {
        goal_id: goalId,
        goal_provisional: false,
        provisional_goal_source: null,
      },
    })
  }

  function selectProvisional() {
    setError(null)
    setConfirmingProvisional(true)
    dispatch({
      type: 'SET_FIELDS',
      fields: {
        goal_id: null,
        goal_provisional: true,
        provisional_goal_source: 'user_deferred',
      },
    })
  }

  function handleContinue() {
    const result = validateGoal(state)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (state.goal_provisional) {
      // Provisional path skips Screen 7b
      router.push('/onboarding/loading')
    } else {
      router.push('/onboarding/own-words')
    }
  }

  const selectedValue = state.goal_provisional
    ? PROVISIONAL_VALUE
    : state.goal_id

  return (
    <ScreenContainer
      top={
        <>
          <QuestionHeading>What are you working toward?</QuestionHeading>
          <HelperCopy>Pick the one that fits closest.</HelperCopy>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-2)' }}>
            {GOAL_OPTIONS_V1.map(opt => (
              <OptionButton
                key={opt.id}
                selected={selectedValue === opt.id}
                onClick={() => selectNamed(opt.id)}
              >
                {opt.display}
              </OptionButton>
            ))}
          </div>

          <Separator label="Or" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-2)' }}>
            <OptionButton
              selected={selectedValue === PROVISIONAL_VALUE}
              onClick={selectProvisional}
            >
              I&rsquo;m not sure yet
            </OptionButton>
          </div>

          {confirmingProvisional ? (
            <BodyCopy>
              No problem. We&rsquo;ll build a sensible first week from what you&rsquo;ve told us, and check in after a few sessions.
            </BodyCopy>
          ) : null}

          <ErrorMessage message={error} />
        </>
      }
      bottom={
        <PrimaryButton
          onClick={handleContinue}
          disabled={state.goal_id == null && !state.goal_provisional}
        >
          Continue
        </PrimaryButton>
      }
    />
  )
}

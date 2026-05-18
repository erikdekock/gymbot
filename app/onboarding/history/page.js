'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import { validateHistory } from '../_state/validators'
import ScreenContainer from '../_components/ScreenContainer'
import QuestionHeading from '../_components/QuestionHeading'
import OptionButton from '../_components/OptionButton'
import PrimaryButton from '../_components/PrimaryButton'
import ErrorMessage from '../_components/ErrorMessage'

/**
 * Screen 1 — Training history.
 *
 * Three options (single-select). If "I have, but it's been a while" is
 * selected, an inline follow-up reveals on the SAME screen.
 *
 * Fields produced: experience_level + archetype_flags.recent_inactivity_months
 * (the latter only when reactivator).
 */

// Primary options → maps to experience_level.
// Order verbatim from spec §7 Screen 1.
const PRIMARY = [
  { value: 'experienced', label: "Yes — I've trained seriously" },
  { value: 'reactivator', label: "I have, but it's been a while" },
  { value: 'starter',     label: 'No, this is new to me' },
]

// Inactivity follow-up. Values in months per spec §2 Screen 1:
//   "A few months" → ~9 (mid of "a few months", treated <=6 elsewhere for
//   A2 conditional but the spec's own §3 says "None / ~9 / ~18 / ~30")
//   "6 to 12 months" → 9, "1 to 2 years" → 18, "More than 2 years" → 30.
// We use 3 for "a few months" so it falls under the A2 ≤6mo bucket — this
// matches the spec semantically: "a few months" implies short inactivity.
const FOLLOWUP = [
  { value: 3,  label: 'A few months' },
  { value: 9,  label: '6 to 12 months' },
  { value: 18, label: '1 to 2 years' },
  { value: 30, label: 'More than 2 years' },
]

export default function HistoryPage() {
  const router = useRouter()
  const { state, dispatch } = useOnboarding()
  const [error, setError] = useState(null)

  function selectPrimary(value) {
    setError(null)
    dispatch({
      type: 'SET_FIELDS',
      fields: {
        experience_level: value,
        // Clear inactivity follow-up if not reactivator
        'archetype_flags.recent_inactivity_months': value === 'reactivator'
          ? state.archetype_flags.recent_inactivity_months
          : null,
      },
    })
  }

  function selectFollowup(months) {
    setError(null)
    dispatch({
      type: 'SET_FIELD',
      path: 'archetype_flags.recent_inactivity_months',
      value: months,
    })
  }

  function handleContinue() {
    const result = validateHistory(state)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/onboarding/cross-modal')
  }

  const showFollowup = state.experience_level === 'reactivator'

  return (
    <ScreenContainer
      top={
        <>
          <QuestionHeading>Have you lifted weights before?</QuestionHeading>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-2)' }}>
            {PRIMARY.map(opt => (
              <OptionButton
                key={opt.value}
                selected={state.experience_level === opt.value}
                onClick={() => selectPrimary(opt.value)}
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>

          {showFollowup ? (
            <div style={{ marginTop: 'var(--rep-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-3)' }}>
              <p className="rep-body" style={{ margin: 0 }}>How long has it been?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-2)' }}>
                {FOLLOWUP.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={state.archetype_flags.recent_inactivity_months === opt.value}
                    onClick={() => selectFollowup(opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </div>
          ) : null}

          <ErrorMessage message={error} />
        </>
      }
      bottom={
        <PrimaryButton onClick={handleContinue}>Continue</PrimaryButton>
      }
    />
  )
}

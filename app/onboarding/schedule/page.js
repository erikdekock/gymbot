'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import { validateSchedule } from '../_state/validators'
import ScreenContainer from '../_components/ScreenContainer'
import QuestionHeading from '../_components/QuestionHeading'
import { HelperCopy } from '../_components/Typography'
import PrimaryButton from '../_components/PrimaryButton'
import ErrorMessage from '../_components/ErrorMessage'

/**
 * Screen 3 — Schedule.
 *
 * Segmented selector 2-6. "Not sure?" link auto-selects 3 with explanatory
 * copy. days_per_week required to proceed.
 */
const DAYS = [2, 3, 4, 5, 6]

export default function SchedulePage() {
  const router = useRouter()
  const { state, dispatch } = useOnboarding()
  const [error, setError] = useState(null)
  const [notSureHint, setNotSureHint] = useState(false)

  function select(n) {
    setError(null)
    dispatch({ type: 'SET_FIELD', path: 'days_per_week', value: n })
  }

  function handleNotSure() {
    setNotSureHint(true)
    select(3)
  }

  function handleContinue() {
    const result = validateSchedule(state)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/onboarding/equipment')
  }

  return (
    <ScreenContainer
      top={
        <>
          <QuestionHeading>How many days a week can you train?</QuestionHeading>
          <HelperCopy>We&rsquo;ll build the week around this — not around an ideal.</HelperCopy>

          <div
            role="radiogroup"
            aria-label="Days per week"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 'var(--rep-space-2)',
              marginTop: 'var(--rep-space-3)',
            }}
          >
            {DAYS.map(n => {
              const selected = state.days_per_week === n
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`rep-option ${selected ? 'rep-option--selected' : ''}`}
                  style={{
                    justifyContent: 'center',
                    fontFamily: 'var(--rep-font-mono)',
                    fontSize: '1.25rem',
                    fontWeight: 500,
                  }}
                  onClick={() => select(n)}
                >
                  {n}
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 'var(--rep-space-4)' }}>
            {!notSureHint ? (
              <button
                type="button"
                className="rep-skip"
                onClick={handleNotSure}
              >
                Not sure?
              </button>
            ) : (
              <HelperCopy>
                Start with 3. You can adjust after your first week.
              </HelperCopy>
            )}
          </div>

          <ErrorMessage message={error} />
        </>
      }
      bottom={
        <PrimaryButton onClick={handleContinue}>Continue</PrimaryButton>
      }
    />
  )
}

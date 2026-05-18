'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import { shouldRenderA2Variant } from '../_state/archetype'
import { softWarnLift } from '../_state/validators'
import ScreenContainer from '../_components/ScreenContainer'
import QuestionHeading from '../_components/QuestionHeading'
import { BodyCopy } from '../_components/Typography'
import KgInput from '../_components/KgInput'
import PrimaryButton from '../_components/PrimaryButton'
import SkipAffordance from '../_components/SkipAffordance'

/**
 * Screen 5 — Body metrics + lifts.
 *
 * Two-mode bridge: IBM Plex Sans for question framing (brand mode);
 * IBM Plex Mono with tabular figures for kg inputs (tool mode).
 *
 * A2 Returning Athlete tonal variant renders when:
 *   experience_level ∈ {active, experienced}
 *   AND recent_inactivity_months ≤ 6 (or null).
 *
 * All fields nullable (Rule 2 fires sparse-profile defaults post-Prelude).
 */

const LIFTS = [
  { key: 'squat',    label: 'Back squat' },
  { key: 'deadlift', label: 'Deadlift' },
  { key: 'bench',    label: 'Bench press' },
  { key: 'ohp',      label: 'Overhead press' },
  { key: 'row',      label: 'Barbell row' },
]

export default function MetricsPage() {
  const router = useRouter()
  const { state, dispatch } = useOnboarding()
  const [skipped, setSkipped] = useState({
    bodyweight: false,
    squat: false, deadlift: false, bench: false, ohp: false, row: false,
  })
  const [softWarnings, setSoftWarnings] = useState({})

  const isA2 = shouldRenderA2Variant(state)

  function setBodyweight(value) {
    setSkipped(s => ({ ...s, bodyweight: false }))
    dispatch({ type: 'SET_FIELD', path: 'bodyweight_kg', value })
  }
  function skipBodyweight() {
    setSkipped(s => ({ ...s, bodyweight: true }))
    dispatch({ type: 'SET_FIELD', path: 'bodyweight_kg', value: null })
  }

  function setLift(key, value) {
    setSkipped(s => ({ ...s, [key]: false }))
    dispatch({ type: 'SET_FIELD', path: `reported_lifts.${key}`, value })
    const warn = softWarnLift(key, value)
    setSoftWarnings(w => ({ ...w, [key]: warn }))
  }
  function skipLift(key) {
    setSkipped(s => ({ ...s, [key]: true }))
    dispatch({ type: 'SET_FIELD', path: `reported_lifts.${key}`, value: null })
    setSoftWarnings(w => ({ ...w, [key]: null }))
  }

  function skipAll() {
    setSkipped({
      bodyweight: true,
      squat: true, deadlift: true, bench: true, ohp: true, row: true,
    })
    dispatch({
      type: 'SET_FIELDS',
      fields: {
        bodyweight_kg: null,
        'reported_lifts.squat':    null,
        'reported_lifts.deadlift': null,
        'reported_lifts.bench':    null,
        'reported_lifts.ohp':      null,
        'reported_lifts.row':      null,
      },
    })
    setSoftWarnings({})
  }

  function handleContinue() {
    router.push('/onboarding/context')
  }

  return (
    <ScreenContainer
      top={
        <>
          <QuestionHeading>Your numbers.</QuestionHeading>

          {isA2 ? (
            <BodyCopy>
              We use these to set Week 1 loads. We apply a conservative multiplier for the first week — the sessions will tell us where to go from there.
            </BodyCopy>
          ) : (
            <BodyCopy>
              We use these to set Week 1 loads. Skip anything you&rsquo;re not sure about — we&rsquo;ll calibrate from your first sessions.
            </BodyCopy>
          )}

          <div style={{ marginTop: 'var(--rep-space-4)' }}>
            <KgInput
              label="Bodyweight"
              value={state.bodyweight_kg}
              onChange={setBodyweight}
              onSkip={skipBodyweight}
              skipped={skipped.bodyweight}
              max={300}
            />
          </div>

          <hr className="rep-separator" />

          <div>
            {LIFTS.map(({ key, label }) => (
              <div key={key}>
                <KgInput
                  label={label}
                  value={state.reported_lifts[key]}
                  onChange={(v) => setLift(key, v)}
                  onSkip={() => skipLift(key)}
                  skipped={skipped[key]}
                />
                {softWarnings[key] ? (
                  <p
                    className="rep-helper"
                    role="status"
                    style={{ margin: '0 0 var(--rep-space-2) 0' }}
                  >
                    {softWarnings[key]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'var(--rep-space-3)' }}>
            <SkipAffordance onClick={skipAll}>SKIP ALL LIFTS</SkipAffordance>
          </div>
        </>
      }
      bottom={
        <PrimaryButton onClick={handleContinue}>Continue</PrimaryButton>
      }
    />
  )
}

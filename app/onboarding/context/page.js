'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import ScreenContainer from '../_components/ScreenContainer'
import QuestionHeading from '../_components/QuestionHeading'
import { BodyCopy } from '../_components/Typography'
import NumberInput from '../_components/NumberInput'
import MultiSelectTile from '../_components/MultiSelectTile'
import PrimaryButton from '../_components/PrimaryButton'

/**
 * Screen 6 — Context + safety.
 *
 * Age + injury multi-select with optional "Other" free-text expansion +
 * postpartum/pregnancy conditional reveals.
 *
 * CRITICAL spec mandate (§4 + §7 Screen 6):
 *   Postpartum/pregnancy fields reveal ONLY on user action. Never via
 *   inference. Auto-reveal based on archetype is a Layer 6 A6 violation.
 *
 * Layer 6 forbidden phrases — never used anywhere on this screen:
 *   "bounce back", "pre-baby body", "regain your figure", "for someone your age"
 */

const INJURY_OPTIONS = [
  { value: 'knee',       label: 'Knee' },
  { value: 'lower_back', label: 'Lower back' },
  { value: 'shoulder',   label: 'Shoulder' },
  { value: 'hip',        label: 'Hip' },
  { value: 'none',       label: 'None' },
]

export default function ContextPage() {
  const router = useRouter()
  const { state, dispatch } = useOnboarding()

  const [otherOpen, setOtherOpen] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [postpartumOpen, setPostpartumOpen] = useState(
    state.archetype_flags.postpartum_months != null,
  )
  const [pregnancyOpen, setPregnancyOpen] = useState(
    state.archetype_flags.pregnancy_gestational_week != null,
  )

  function setAge(v) {
    dispatch({ type: 'SET_FIELD', path: 'archetype_flags.age', value: v })
  }
  function skipAge() {
    dispatch({ type: 'SET_FIELD', path: 'archetype_flags.age', value: null })
  }

  function toggleInjury(value) {
    let next
    if (value === 'none') {
      // 'None' clears all and is mutually exclusive
      next = state.contraindications.includes('none') ? [] : ['none']
      setOtherOpen(false)
    } else {
      const without = state.contraindications.filter(v => v !== 'none')
      next = without.includes(value)
        ? without.filter(v => v !== value)
        : [...without, value]
    }
    dispatch({ type: 'SET_FIELD', path: 'contraindications', value: next })
  }

  function toggleOther() {
    const opening = !otherOpen
    setOtherOpen(opening)
    if (!opening) {
      // Closing 'Other' removes any 'other:*' entry
      const cleaned = state.contraindications.filter(v => !v.startsWith('other:'))
      dispatch({ type: 'SET_FIELD', path: 'contraindications', value: cleaned })
      setOtherText('')
    }
  }

  function setOtherTextValue(v) {
    setOtherText(v)
    const cleaned = state.contraindications.filter(c => !c.startsWith('other:'))
    const next = v.trim().length > 0 ? [...cleaned, `other:${v.trim()}`] : cleaned
    dispatch({ type: 'SET_FIELD', path: 'contraindications', value: next })
  }

  function togglePostpartum() {
    const opening = !postpartumOpen
    setPostpartumOpen(opening)
    if (!opening) {
      dispatch({ type: 'SET_FIELD', path: 'archetype_flags.postpartum_months', value: null })
    }
  }
  function setPostpartumMonths(v) {
    dispatch({ type: 'SET_FIELD', path: 'archetype_flags.postpartum_months', value: v })
  }

  function togglePregnancy() {
    const opening = !pregnancyOpen
    setPregnancyOpen(opening)
    if (!opening) {
      dispatch({ type: 'SET_FIELD', path: 'archetype_flags.pregnancy_gestational_week', value: null })
    }
  }
  function setPregnancyWeeks(v) {
    dispatch({ type: 'SET_FIELD', path: 'archetype_flags.pregnancy_gestational_week', value: v })
  }

  function handleContinue() {
    router.push('/onboarding/goal')
  }

  return (
    <ScreenContainer
      top={
        <>
          <QuestionHeading>A couple of things that help us calibrate.</QuestionHeading>

          <NumberInput
            label="Age"
            subLabel="helps with load settings"
            value={state.archetype_flags.age}
            onChange={setAge}
            onSkip={skipAge}
            min={10}
            max={100}
          />

          <hr className="rep-separator" />

          <BodyCopy>Any pain or injury we should work around?</BodyCopy>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-2)' }}>
            {INJURY_OPTIONS.map(opt => (
              <MultiSelectTile
                key={opt.value}
                selected={state.contraindications.includes(opt.value)}
                onClick={() => toggleInjury(opt.value)}
              >
                {opt.label}
              </MultiSelectTile>
            ))}
            <MultiSelectTile selected={otherOpen} onClick={toggleOther}>
              Other
            </MultiSelectTile>
            {otherOpen ? (
              <input
                type="text"
                className="rep-num-input"
                style={{ width: '100%', textAlign: 'left' }}
                placeholder="Describe briefly"
                value={otherText}
                maxLength={120}
                onChange={(e) => setOtherTextValue(e.target.value)}
                aria-label="Other injury description"
              />
            ) : null}
          </div>

          {/* User-action-only affordances. Never auto-reveal. */}
          <div style={{ marginTop: 'var(--rep-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-3)' }}>
            <button
              type="button"
              className="rep-skip"
              onClick={togglePostpartum}
              aria-expanded={postpartumOpen}
            >
              Returning after pregnancy or postpartum?
            </button>
            {postpartumOpen ? (
              <NumberInput
                label="How many months ago did you give birth?"
                value={state.archetype_flags.postpartum_months}
                onChange={setPostpartumMonths}
                min={0}
                max={120}
              />
            ) : null}

            <button
              type="button"
              className="rep-skip"
              onClick={togglePregnancy}
              aria-expanded={pregnancyOpen}
            >
              Currently pregnant?
            </button>
            {pregnancyOpen ? (
              <NumberInput
                label="How many weeks along are you?"
                value={state.archetype_flags.pregnancy_gestational_week}
                onChange={setPregnancyWeeks}
                min={1}
                max={42}
              />
            ) : null}
          </div>
        </>
      }
      bottom={
        <PrimaryButton onClick={handleContinue}>Continue</PrimaryButton>
      }
    />
  )
}

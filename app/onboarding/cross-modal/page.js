'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import ScreenContainer from '../_components/ScreenContainer'
import QuestionHeading from '../_components/QuestionHeading'
import { HelperCopy } from '../_components/Typography'
import MultiSelectTile from '../_components/MultiSelectTile'
import PrimaryButton from '../_components/PrimaryButton'
import SkipAffordance from '../_components/SkipAffordance'

/**
 * Screen 2 — Cross-modal training.
 *
 * Multi-select; "No — strength only" mutually exclusive with the others.
 *
 * The contract field is `training_history_cross_modal` (boolean). The raw
 * modality list is UI-only — kept in local React state. Spec §1 explicitly
 * accepts "Lost-on-refresh acceptable for a 5-min flow"; back-nav loss
 * sits under the same allowance.
 */
const STRENGTH_ONLY = 'strength_only'
const OPTIONS = [
  { value: 'running_cycling', label: 'Running or cycling' },
  { value: 'team_sports',     label: 'Team sports' },
  { value: 'combat_sports',   label: 'Combat sports or martial arts' },
  { value: 'yoga_mobility',   label: 'Yoga or mobility work' },
  { value: STRENGTH_ONLY,     label: 'No — strength only' },
]

function computeCrossModalFlag(selected) {
  if (selected.length === 0) return null
  return !(selected.length === 1 && selected[0] === STRENGTH_ONLY)
}

export default function CrossModalPage() {
  const router = useRouter()
  const { state, dispatch } = useOnboarding()

  // Rehydrate selection from contract on remount (best-effort, lossy).
  const [selected, setSelected] = useState(() => {
    if (state.training_history_cross_modal === false) return [STRENGTH_ONLY]
    return []
  })

  function toggle(value) {
    setSelected(prev => {
      if (value === STRENGTH_ONLY) {
        return prev.includes(STRENGTH_ONLY) ? [] : [STRENGTH_ONLY]
      }
      const without = prev.filter(v => v !== STRENGTH_ONLY)
      return without.includes(value)
        ? without.filter(v => v !== value)
        : [...without, value]
    })
  }

  function persist(value) {
    dispatch({ type: 'SET_FIELD', path: 'training_history_cross_modal', value })
  }

  function handleContinue() {
    persist(computeCrossModalFlag(selected))
    router.push('/onboarding/schedule')
  }

  function handleSkip() {
    persist(null)
    router.push('/onboarding/schedule')
  }

  return (
    <ScreenContainer
      top={
        <>
          <QuestionHeading>Do you train in other ways alongside strength work?</QuestionHeading>
          <HelperCopy>Select everything that applies.</HelperCopy>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-2)' }}>
            {OPTIONS.map(opt => (
              <MultiSelectTile
                key={opt.value}
                selected={selected.includes(opt.value)}
                onClick={() => toggle(opt.value)}
              >
                {opt.label}
              </MultiSelectTile>
            ))}
          </div>

          <div style={{ marginTop: 'var(--rep-space-4)' }}>
            <SkipAffordance onClick={handleSkip}>Skip for now</SkipAffordance>
          </div>
        </>
      }
      bottom={
        <PrimaryButton onClick={handleContinue} disabled={selected.length === 0}>
          Continue
        </PrimaryButton>
      }
    />
  )
}

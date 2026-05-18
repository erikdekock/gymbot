'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import { validateEquipment } from '../_state/validators'
import ScreenContainer from '../_components/ScreenContainer'
import QuestionHeading from '../_components/QuestionHeading'
import { HelperCopy } from '../_components/Typography'
import MultiSelectTile from '../_components/MultiSelectTile'
import PrimaryButton from '../_components/PrimaryButton'
import ErrorMessage from '../_components/ErrorMessage'

/**
 * Screen 4 — Equipment.
 *
 * Multi-select; at least one selection required. Spec §7 error copy:
 * 'Select at least one — even bodyweight only works.'
 */
const OPTIONS = [
  { value: 'full_gym',     label: 'Full gym (barbells, racks, machines)' },
  { value: 'db_cables',    label: 'Dumbbells and cables' },
  { value: 'db_only',      label: 'Dumbbells only' },
  { value: 'kettlebells',  label: 'Kettlebells' },
  { value: 'pullup_floor', label: 'Pull-up bar and floor' },
  { value: 'bodyweight',   label: 'No equipment (bodyweight only)' },
]

export default function EquipmentPage() {
  const router = useRouter()
  const { state, dispatch } = useOnboarding()
  const [error, setError] = useState(null)

  function toggle(value) {
    setError(null)
    const next = state.equipment_available.includes(value)
      ? state.equipment_available.filter(v => v !== value)
      : [...state.equipment_available, value]
    dispatch({ type: 'SET_FIELD', path: 'equipment_available', value: next })
  }

  function handleContinue() {
    const result = validateEquipment(state)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/onboarding/metrics')
  }

  return (
    <ScreenContainer
      top={
        <>
          <QuestionHeading>What do you have access to when you train?</QuestionHeading>
          <HelperCopy>Select everything that applies.</HelperCopy>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-2)' }}>
            {OPTIONS.map(opt => (
              <MultiSelectTile
                key={opt.value}
                selected={state.equipment_available.includes(opt.value)}
                onClick={() => toggle(opt.value)}
              >
                {opt.label}
              </MultiSelectTile>
            ))}
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

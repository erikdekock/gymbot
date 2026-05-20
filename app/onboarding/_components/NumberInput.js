'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Integer input — used for age (Screen 6), postpartum months, pregnancy
 * gestational week. IBM Plex Sans (not mono — these are not lift loads).
 *
 * Validation strategy: decoupled raw-string local state for the input
 * value, numeric value pushed to parent state only on parse. No keystroke
 * rejection. Lower-bound check on blur clears invalid partials.
 *
 * Previous fix attempt (20 May) used `value={display}` directly with
 * controlled-input onChange that rejected partials. That fix did not
 * resolve the reported bug — likely an iOS Safari controlled-input
 * interaction where React's controlled value lagged the user's keystroke,
 * causing cursor/value desync. Decoupled raw-string state avoids the
 * issue entirely: the input is controlled by local state, not parent.
 *
 * Per consumer:
 *   Age (Screen 6) — min=13, max=99, maxLength=2
 *   Postpartum months — min=0, max=120, maxLength=3
 *   Pregnancy weeks — min=1, max=42, maxLength=2
 *
 * @param {{
 *   label: string,
 *   subLabel?: string,
 *   value: number|null,
 *   onChange: (next: number|null) => void,
 *   onSkip?: () => void,
 *   min?: number,
 *   max?: number,
 *   placeholder?: string,
 * }} props
 */
export default function NumberInput({
  label,
  subLabel,
  value,
  onChange,
  onSkip,
  min = 0,
  max = 120,
  placeholder = '',
}) {
  // Local raw-string state mirrors what the user typed. Initialised from
  // parent value; synced when parent value changes externally (e.g. on
  // Skip clearing). The user's typing is never reflected from parent
  // state back into this local state.
  const [raw, setRaw] = useState(value == null ? '' : String(value))
  const lastValueRef = useRef(value)

  // Sync raw when parent value changes via something other than typing
  // (Skip button, Back navigation rehydrating with new state, etc.)
  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value
      setRaw(value == null ? '' : String(value))
    }
  }, [value])

  // Cap maxLength to fit the max (e.g. max=99 → 2 digits, max=120 → 3).
  const maxLength = String(max).length

  function handleChange(e) {
    // Strip non-digits, cap length. Never reject; always reflect user's
    // intent in the input.
    const next = e.target.value.replace(/\D/g, '').slice(0, maxLength)
    setRaw(next)

    // Push to parent only when parseable. Empty string → null.
    if (next === '') {
      lastValueRef.current = null
      onChange(null)
      return
    }
    const num = parseInt(next, 10)
    if (!Number.isNaN(num)) {
      lastValueRef.current = num
      onChange(num)
    }
  }

  function handleBlur() {
    // On blur, if the parsed value is below min, clear it. Prevents
    // committing invalid partials (e.g. "1" when min=13).
    if (raw === '') return
    const num = parseInt(raw, 10)
    if (Number.isNaN(num) || num < min) {
      setRaw('')
      lastValueRef.current = null
      onChange(null)
    }
  }

  return (
    <div className="rep-num-row">
      <div className="rep-num-row__labels">
        <label className="rep-num-row__label">{label}</label>
        {subLabel ? <span className="rep-num-row__sublabel">{subLabel}</span> : null}
      </div>
      <div className="rep-num-row__field">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="rep-num-input"
          placeholder={placeholder}
          value={raw}
          maxLength={maxLength}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-label={label}
        />
        {onSkip ? (
          <button
            type="button"
            className="rep-num-row__skip"
            onClick={onSkip}
            aria-label={`Skip ${label}`}
          >
            SKIP
          </button>
        ) : null}
      </div>
    </div>
  )
}

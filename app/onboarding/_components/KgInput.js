'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Kilogram input row for Screen 5 — IBM Plex Mono with tabular figures,
 * `inputMode="decimal"` for mobile numeric keypad.
 *
 * Decoupled raw-string state: local React state mirrors what the user
 * typed. Numeric value pushed to parent only on parse. No keystroke
 * rejection — the input always reflects user intent.
 *
 * Previous fix attempt (20 May) used `value={display}` directly with an
 * onChange that returned early without calling setState when the parsed
 * number was out of range. On iOS Safari this produced cursor/value
 * desync where each keystroke could clobber prior accepted characters.
 * Decoupled raw-string state avoids the issue.
 *
 * Fresh-signup: value is null from initialOnboardingState, the input
 * renders empty, placeholder "kg" shows in graphite-30. No default load.
 *
 * Within-session persistence: OnboardingContext retains entered values
 * across navigation. The local raw state syncs on external value changes
 * (Skip clear, Back rehydrating with prior state).
 *
 * @param {{
 *   label: string,
 *   value: number|null,
 *   onChange: (next: number|null) => void,
 *   onSkip: () => void,
 *   skipped: boolean,
 *   max?: number,
 * }} props
 */
export default function KgInput({ label, value, onChange, onSkip, skipped, max = 500 }) {
  const [raw, setRaw] = useState(value == null ? '' : String(value))
  const lastValueRef = useRef(value)

  // Sync raw on external value changes (Skip, Back rehydration, parent
  // updates) — but never reflect typing back from parent state.
  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value
      setRaw(value == null ? '' : String(value))
    }
  }, [value])

  function handleChange(e) {
    // Allow digits + single decimal point. Cap to 5 chars (e.g. 999.5).
    let next = e.target.value.replace(/[^0-9.]/g, '')
    // Collapse multiple decimals to first one.
    const firstDot = next.indexOf('.')
    if (firstDot !== -1) {
      next = next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, '')
    }
    next = next.slice(0, 5)
    setRaw(next)

    if (next === '' || next === '.') {
      lastValueRef.current = null
      onChange(null)
      return
    }
    const num = parseFloat(next)
    if (!Number.isNaN(num) && num >= 1 && num <= max) {
      lastValueRef.current = num
      onChange(num)
    }
    // If parsed is out of range, raw stays in local state but parent
    // value is not updated. Final blur-clear if needed.
  }

  function handleBlur() {
    if (raw === '' || raw === '.') return
    const num = parseFloat(raw)
    if (Number.isNaN(num) || num < 1 || num > max) {
      setRaw('')
      lastValueRef.current = null
      onChange(null)
    }
  }

  return (
    <div className={`rep-kg-row ${skipped ? 'rep-kg-row--skipped' : ''}`}>
      <label className="rep-kg-row__label">{label}</label>
      <div className="rep-kg-row__field">
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          className="rep-kg-input"
          placeholder="kg"
          value={raw}
          disabled={skipped}
          maxLength={5}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-label={`${label} in kilograms`}
        />
        <span className="rep-kg-input__unit" aria-hidden="true">kg</span>
      </div>
      <button
        type="button"
        className="rep-kg-row__skip"
        onClick={onSkip}
        aria-label={`Skip ${label}`}
      >
        SKIP
      </button>
    </div>
  )
}

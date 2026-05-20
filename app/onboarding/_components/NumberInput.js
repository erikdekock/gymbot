'use client'

/**
 * Integer input — used for age (Screen 6), postpartum months, pregnancy
 * gestational week. IBM Plex Sans (not mono — these are not lift loads).
 *
 * Validation strategy: accept any partial integer typing up to maxLength
 * digits, then clamp to [min, max] only on the final committed value.
 * The previous on-keystroke `if (num < min || num > max) return` broke
 * input for any min > single-digit values: typing the first digit of a
 * two-digit value was rejected because it tested below `min`.
 *
 * Per consumer:
 *   Age (Screen 6) — min=13, max=99, maxLength=2
 *   Postpartum months (Screen 6) — min=0, max=120, maxLength=3
 *   Pregnancy weeks (Screen 6) — min=1, max=42, maxLength=2
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
  const display = value == null ? '' : String(value)
  // Cap maxLength to fit the max value (e.g. max=99 → 2 digits, max=120 → 3).
  const maxLength = String(max).length
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
          value={display}
          maxLength={maxLength}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '')
            if (raw === '') return onChange(null)
            const num = parseInt(raw, 10)
            if (Number.isNaN(num)) return onChange(null)
            // Clamp upper bound on commit; lower bound is checked at
            // submit time, not keystroke time, so users can type freely.
            if (num > max) return
            onChange(num)
          }}
          onBlur={() => {
            // On blur, if value is below min, clear it. Prevents committing
            // an invalid partial like "1" when min=13.
            if (value != null && value < min) onChange(null)
          }}
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

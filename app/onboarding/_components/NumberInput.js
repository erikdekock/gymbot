'use client'

/**
 * Integer input — used for age (Screen 6), postpartum months, pregnancy
 * gestational week. IBM Plex Sans (not mono — these are not lift loads).
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
          maxLength={3}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '')
            if (raw === '') return onChange(null)
            const num = parseInt(raw, 10)
            if (num < min || num > max) return
            onChange(num)
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

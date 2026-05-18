'use client'

/**
 * Kilogram input row for Screen 5 — IBM Plex Mono with tabular figures,
 * `inputMode="decimal"` for mobile numeric keypad. Value bridges to React
 * state via parseFloat; empty string → null.
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
  const display = value == null ? '' : String(value)
  return (
    <div className={`rep-kg-row ${skipped ? 'rep-kg-row--skipped' : ''}`}>
      <label className="rep-kg-row__label">{label}</label>
      <div className="rep-kg-row__field">
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          className="rep-kg-input"
          placeholder="—"
          value={display}
          disabled={skipped}
          maxLength={5}
          onChange={(e) => {
            const raw = e.target.value.trim()
            if (raw === '') return onChange(null)
            const num = parseFloat(raw)
            if (Number.isNaN(num)) return onChange(null)
            if (num < 1 || num > max) return // soft reject; keep prior state
            onChange(num)
          }}
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

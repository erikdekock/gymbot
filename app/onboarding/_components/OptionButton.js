'use client'

/**
 * Single-select option button. Large tap target (48pt minimum) for the
 * one-handed mobile gym context (matches Moment 2b precedent).
 *
 * Active state uses border-weight increase + inline checkmark icon, NOT
 * color alone — DS v1.1 §7.3 Differentiate Without Color.
 *
 * @param {{
 *   selected: boolean,
 *   onClick: () => void,
 *   children: React.ReactNode,
 * }} props
 */
export default function OptionButton({ selected, onClick, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`rep-option ${selected ? 'rep-option--selected' : ''}`}
      onClick={onClick}
    >
      <span className="rep-option__label">{children}</span>
      <span className="rep-option__check" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
    </button>
  )
}

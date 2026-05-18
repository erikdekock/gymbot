'use client'

/**
 * Multi-select tile — Screens 2 (cross-modal), 4 (equipment), 6 (injury).
 * Same large tap target as OptionButton; differentiated active state via
 * border + checkmark icon, not color alone.
 *
 * @param {{
 *   selected: boolean,
 *   onClick: () => void,
 *   children: React.ReactNode,
 * }} props
 */
export default function MultiSelectTile({ selected, onClick, children }) {
  return (
    <button
      type="button"
      role="checkbox"
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

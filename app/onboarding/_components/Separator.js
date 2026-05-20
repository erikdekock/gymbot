'use client'

/**
 * Separator with optional "Or" label centred above.
 * Used on Screen 7 to visually separate named goals from "I'm not sure yet"
 * per CEO direction 13 May 2026 (separation by structure, not by damping).
 *
 * @param {{ label?: string }} props
 */
export default function Separator({ label }) {
  if (label) {
    return (
      <div className="rep-separator rep-separator--labeled" role="separator" aria-orientation="horizontal">
        <span className="rep-separator__label">{label}</span>
      </div>
    )
  }
  return <hr className="rep-separator" />
}

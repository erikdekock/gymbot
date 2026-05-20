'use client'

/**
 * Standard layout for every Prelude screen.
 *
 * - Fills viewport between progress line and bottom edge
 * - `top` slot scrolls; `bottom` slot is sticky-anchored for thumb reach
 * - Padding tokens come from --rep-space-*; never inline magic numbers
 *
 * @param {{
 *   top: React.ReactNode,
 *   bottom?: React.ReactNode,
 * }} props
 */
export default function ScreenContainer({ top, bottom }) {
  return (
    <div className="rep-screen">
      <div className="rep-screen__top">{top}</div>
      {bottom ? <div className="rep-screen__bottom">{bottom}</div> : null}
    </div>
  )
}

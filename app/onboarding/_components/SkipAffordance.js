'use client'

/**
 * Small secondary "skip" affordance — surface-30 text, no border.
 * Used below option lists (Screen 2 "Skip for now") and as inline link.
 *
 * @param {{ children: React.ReactNode, onClick: () => void }} props
 */
export default function SkipAffordance({ children, onClick }) {
  return (
    <button type="button" className="rep-skip" onClick={onClick}>
      {children}
    </button>
  )
}

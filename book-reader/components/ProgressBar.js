'use client'

// Thin reading-progress bar that sits at the very top of the screen.
export default function ProgressBar({ percent }) {
  const pct = Math.max(0, Math.min(100, percent || 0))
  return (
    <div
      className="fixed left-0 right-0 top-0 z-40 h-[3px]"
      style={{ background: 'var(--rule)' }}
      aria-hidden="true"
    >
      <div
        className="h-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: 'var(--accent)' }}
      />
    </div>
  )
}

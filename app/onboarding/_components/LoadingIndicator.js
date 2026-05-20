'use client'

/**
 * Indeterminate forest sage progress indicator for Screen 8 loading state.
 * Not a spinner, not a countdown. Reduce Motion fallback: static 50% line.
 *
 * Per spec §2 Screen 8: "thin forest sage progress indicator
 * (indeterminate, not a countdown)."
 */
export default function LoadingIndicator() {
  return (
    <div className="rep-loading" role="progressbar" aria-label="Loading">
      <div className="rep-loading__bar" />
    </div>
  )
}

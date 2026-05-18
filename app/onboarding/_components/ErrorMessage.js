'use client'

/**
 * Inline error message. Renders only when `message` is non-empty.
 * Uses --error token; paired with role="alert" for screen readers.
 *
 * @param {{ message: string|null }} props
 */
export default function ErrorMessage({ message }) {
  if (!message) return null
  return (
    <p className="rep-error" role="alert" aria-live="polite">
      {message}
    </p>
  )
}

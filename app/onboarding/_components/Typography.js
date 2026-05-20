'use client'

/** Standard body paragraph. surface-10 on surface-100; rem-based. */
export function BodyCopy({ children }) {
  return <p className="rep-body">{children}</p>
}

/** Secondary smaller copy — surface-30, used for helpers, sub-labels, skip rationale. */
export function HelperCopy({ children }) {
  return <p className="rep-helper">{children}</p>
}

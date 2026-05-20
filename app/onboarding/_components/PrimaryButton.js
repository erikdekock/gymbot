'use client'

/**
 * Primary CTA button — filled sage stamp per DS v1.1 §4.3 + §8.1.
 * Plex Mono uppercase letterspaced text on sage fill. Paper-100 text on
 * sage gives WCAG AAA contrast.
 *
 * 48pt minimum height per 12.2 brief (matches Moment 2b precedent).
 * Focus ring inherits from .rep-onboarding :focus-visible global rule.
 *
 * Variants:
 *   primary — filled sage stamp (default)
 *   ghost   — secondary control, sentence case, paper-80 border
 *
 * @param {{
 *   children: React.ReactNode,
 *   onClick?: () => void,
 *   disabled?: boolean,
 *   type?: 'button'|'submit',
 *   variant?: 'primary'|'ghost',
 * }} props
 */
export default function PrimaryButton({
  children,
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
}) {
  const cls = variant === 'ghost' ? 'rep-btn rep-btn--ghost' : 'rep-btn rep-btn--primary'
  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

'use client'

/**
 * Primary CTA button — outlined style per DS v1.1 §4.4 WCAG verification:
 * off-white text on surface-100 (14.1:1 AAA) + accent border (4.0:1 ✓ for UI
 * components). Filled accent variant rejected for body text (3.5:1 fail).
 *
 * 48pt minimum height per 12.2 brief (matches Moment 2b precedent).
 * Focus ring inherits from .rep-onboarding :focus-visible global rule.
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

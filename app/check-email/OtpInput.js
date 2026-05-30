'use client'
import { useEffect, useRef } from 'react'

/**
 * .rep-otp — v1.1.2 code input (UX/UI OTP Surface Spec §04/§05).
 *
 * Six visual cells rendered OVER a single underlying <input maxlength="6">,
 * per the spec's explicit implementation recommendation. One input keeps
 * paste, iOS one-time-code autofill, and screen-reader behaviour robust and
 * sidesteps the focus-juggling bugs of six separate inputs.
 *
 * The parent owns `value` (a 0–6 digit string) and is notified via onChange.
 * When the sixth digit lands, onComplete fires (auto-submit, no Verify button).
 *
 * @param {{
 *   value: string,            // the live input value (drives typing)
 *   onChange: (next: string) => void,
 *   onComplete: (code: string) => void,
 *   displayValue?: string,    // digits shown in the cells; defaults to value.
 *                             // On an error beat the parent keeps the failed
 *                             // attempt here (red, filled) while value is reset.
 *   error?: boolean,          // wrong/expired → red borders
 *   verifying?: boolean,      // lock + 50% opacity while verifyOtp is in flight
 *   describedById?: string    // id of the inline error message for aria
 * }} props
 */
export default function OtpInput({
  value,
  onChange,
  onComplete,
  displayValue,
  error = false,
  verifying = false,
  describedById,
}) {
  const inputRef = useRef(null)

  // Focus cell 1 on mount (default state per spec §02).
  useEffect(() => {
    if (!verifying) inputRef.current?.focus()
  }, [verifying])

  function handleChange(e) {
    // type="text" + strip everything but digits → keeps leading zeros, no
    // spinners, tolerant of pasted "123 456" / autofilled strings. Take the
    // first six digits if a longer string arrives.
    const next = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange(next)
    if (next.length === 6) onComplete(next)
  }

  const cells = displayValue ?? value
  const focusIdx = value.length // next empty cell

  return (
    <div className="rep-otp-field">
      <div
        className={`rep-otp${error ? ' is-error' : ''}${verifying ? ' is-verifying' : ''}`}
        role="group"
        aria-label="6-digit code"
        aria-describedby={describedById}
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i < cells.length
          const isActive = !verifying && !error && value.length < 6 && i === focusIdx
          return (
            <div
              key={i}
              className={`rep-otp-cell${filled ? ' is-filled' : ''}${isActive ? ' is-focused' : ''}`}
            >
              {isActive ? <span className="rep-otp-caret" /> : filled ? cells[i] : ''}
            </div>
          )
        })}
      </div>
      <input
        ref={inputRef}
        className="rep-otp-field__input"
        // type="text" (NOT number) — avoids spinners, keeps leading zeros,
        // allows paste. inputmode/pattern trigger the iOS numeric pad.
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={handleChange}
        disabled={verifying}
        aria-label="6-digit code"
        aria-describedby={describedById}
      />
    </div>
  )
}

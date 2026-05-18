'use client'

/**
 * REPRISE wordmark — Big Shoulders Display 900, all caps.
 *
 * Spec §2 Screen 0: small, top-left (recedes).
 * Spec §2 Screen 9: returns to primary position (size="primary").
 *
 * @param {{ size?: 'small'|'primary' }} props
 */
export default function Wordmark({ size = 'small' }) {
  return (
    <span className={`rep-wordmark rep-wordmark--${size}`}>
      REPRISE
    </span>
  )
}

import { createHash, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

// Server-only dashboard gate. The password is checked here and the cookie it
// sets is httpOnly, so the browser never holds the password and client JS
// cannot read the session. DASHBOARD_PASSWORD is the server-only variable;
// the old NEXT_PUBLIC_ one is still accepted so existing deploys keep working.
export const DASHBOARD_PASSWORD =
  process.env.DASHBOARD_PASSWORD || process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD || ''

export const DASHBOARD_COOKIE = 'br_dash'

export function tokenFor(password) {
  return createHash('sha256').update(`br-dash:${password}`).digest('hex')
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

export function checkPassword(supplied) {
  return Boolean(DASHBOARD_PASSWORD) && safeEqual(supplied, DASHBOARD_PASSWORD)
}

/** True when the request carries a valid dashboard cookie. */
export function isDashboardAuthed() {
  if (!DASHBOARD_PASSWORD) return false
  const value = cookies().get(DASHBOARD_COOKIE)?.value
  return Boolean(value) && safeEqual(value, tokenFor(DASHBOARD_PASSWORD))
}

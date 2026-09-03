'use client'

// Reader identity + per-reader persisted state, all in localStorage.
// No login: the unique ?id= in the URL is the identity.

const ID_KEY = 'br_reader_id'
const REGISTERED_KEY = 'br_registered'

function randomId() {
  // URL-safe, ~22 chars. crypto when available, Math.random fallback.
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24)
}

export function generateReaderId() {
  return randomId()
}

// Resolves the reader id: prefer the ?id= in the URL, else a stored id, else
// generate a fresh one and write it into the URL (so the link is shareable).
export function resolveReaderId() {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  let id = params.get('id')

  if (!id) {
    id = localStorage.getItem(ID_KEY) || generateReaderId()
    params.set('id', id)
    const url = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', url)
  }

  localStorage.setItem(ID_KEY, id)
  return id
}

// The pre-accounts reader id, if this browser has one. Read only — it does not
// create an id or touch the URL. On first login it's handed to the server so
// the old rows can be adopted by the new auth user, then dropped.
export function getLegacyReaderId() {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(ID_KEY) || null
  } catch {
    return null
  }
}

export function clearLegacyReaderId() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(ID_KEY)
  } catch {
    /* ignore */
  }
}

// The ?ref= id, if this reader arrived via someone else's share link. Captured
// once (the first visit) so we can build the referral chain in the dashboard.
export function getReferral() {
  if (typeof window === 'undefined') return null
  const ref = new URLSearchParams(window.location.search).get('ref')
  return ref && ref.trim() ? ref.trim() : null
}

export function isRegistered(readerId) {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(`${REGISTERED_KEY}_${readerId}`) === '1'
}

export function markRegistered(readerId) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${REGISTERED_KEY}_${readerId}`, '1')
}

// --- Per-reader reading position + preferences -------------------------------

function positionKey(readerId) {
  return `br_position_${readerId}`
}

export function loadPosition(readerId) {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(positionKey(readerId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function savePosition(readerId, position) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(positionKey(readerId), JSON.stringify(position))
  } catch {
    /* storage full / disabled — ignore */
  }
}

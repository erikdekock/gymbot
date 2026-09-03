'use client'

// ===========================================================================
//  CDP event stream — client side.
//
//  Events are queued in memory and flushed to /api/events every 10s, plus on
//  visibilitychange and pagehide via navigator.sendBeacon(), which is the only
//  transport the browser guarantees during unload. That's what stops the last
//  events of a session (the interesting ones) from being lost.
//
//  Nothing here throws: if the endpoint is down or auth is off, events are
//  dropped quietly and reading is never interrupted.
// ===========================================================================

const ENDPOINT = '/api/events'
const FLUSH_MS = 10000
const MAX_QUEUE = 200
const DWELL_KEY = 'br_dwells'

let queue = []
let session = null
let timer = null
let started = false
let consent = true

// --- session context (collected once) ---------------------------------------

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function detectContext() {
  const ua = navigator.userAgent || ''
  const mobile = /Mobi|Android|iPhone|iPod/i.test(ua)
  const tablet = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobi/i.test(ua))
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua)
      ? 'macOS'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad|iPod/i.test(ua)
          ? 'iOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'unknown'
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\//i.test(ua)
      ? 'Opera'
      : /Chrome\//i.test(ua)
        ? 'Chrome'
        : /Safari\//i.test(ua) && !/Chrome/i.test(ua)
          ? 'Safari'
          : /Firefox\//i.test(ua)
            ? 'Firefox'
            : 'unknown'

  const params = new URLSearchParams(window.location.search)
  return {
    device_type: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop',
    os,
    browser,
    screen_w: window.screen?.width || null,
    screen_h: window.screen?.height || null,
    viewport_w: window.innerWidth || null,
    viewport_h: window.innerHeight || null,
    language: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    referrer: document.referrer ? document.referrer.slice(0, 500) : null,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  }
}

/** Start (or restart) an analytics session. Safe to call more than once. */
export function startSession({ enabled = true } = {}) {
  consent = enabled
  if (started) return session
  started = true
  session = { id: uuid(), startedAt: Date.now(), context: detectContext() }

  timer = setInterval(() => flush(false), FLUSH_MS)

  const onHide = () => {
    if (document.visibilityState === 'hidden') {
      track('tab_hidden')
      flush(true)
    } else {
      track('tab_visible')
    }
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', () => {
    endSession()
    flush(true)
  })

  track('session_started')
  return session
}

export function endSession() {
  if (!session) return
  track('session_ended', { duration_seconds: Math.round((Date.now() - session.startedAt) / 1000) })
}

export function setConsent(value) {
  consent = Boolean(value)
}

/** Queue one event. */
export function track(eventType, payload = {}, opts = {}) {
  if (!session || !consent) return
  const { chapter = null, location = null } = opts
  queue.push({
    event_type: eventType,
    chapter_number: chapter,
    location,
    payload,
    occurred_at: new Date().toISOString(),
  })
  if (queue.length >= MAX_QUEUE) flush(false)
}

/** Send everything queued. `beacon` uses sendBeacon so it survives unload. */
export function flush(beacon = false) {
  if (!session || !queue.length) return
  const body = JSON.stringify({
    session_id: session.id,
    context: session.context,
    events: queue,
  })
  queue = []

  try {
    if (beacon && navigator.sendBeacon) {
      // Blob with an explicit type so the route handler sees JSON.
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
      return
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
credentials: 'same-origin',
    }).catch(() => {})
  } catch {
    /* never let analytics break reading */
  }
}

// --- dwell statistics (for stall detection) ---------------------------------

function readDwells() {
  try {
    const raw = localStorage.getItem(DWELL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeDwells(list) {
  try {
    localStorage.setItem(DWELL_KEY, JSON.stringify(list.slice(-200)))
  } catch {
    /* storage full or disabled */
  }
}

/** Records a page dwell and returns the reader's own median. */
export function recordDwell(seconds) {
  if (!(seconds > 0)) return medianDwell()
  const list = readDwells()
  list.push(Math.round(seconds))
  writeDwells(list)
  return medianDwell(list)
}

export function medianDwell(list) {
  const l = (list || readDwells()).slice().sort((a, b) => a - b)
  if (!l.length) return 0
  const mid = Math.floor(l.length / 2)
  return l.length % 2 ? l[mid] : Math.round((l[mid - 1] + l[mid]) / 2)
}

export function dwellSampleCount() {
  return readDwells().length
}

export function getSessionId() {
  return session ? session.id : null
}

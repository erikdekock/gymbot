// Screen Wake Lock. Acquired on session start, released on Done/Stop. The lock
// is auto-released by the browser when the page is hidden, so we re-acquire on
// visibilitychange while a session is active. Degrades gracefully where the API
// is unsupported (e.g. some iOS versions).

let sentinel = null
let wanted = false

async function acquire() {
  if (!('wakeLock' in navigator)) return
  if (document.visibilityState !== 'visible') return
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
  } catch {
    /* request can reject (e.g. low battery, permissions) — non-fatal */
  }
}

export async function requestWakeLock() {
  wanted = true
  await acquire()
}

export async function releaseWakeLock() {
  wanted = false
  if (sentinel) {
    try {
      await sentinel.release()
    } catch {
      /* ignore */
    }
    sentinel = null
  }
}

// Re-acquire when the page becomes visible again mid-session.
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible' && !sentinel) acquire()
})
